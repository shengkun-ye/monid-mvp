import json
import os
import time
from typing import Any, Dict, Optional

import requests
import streamlit as st


def _load_env_from_dotenv() -> None:
  root_dir = os.path.dirname(os.path.abspath(__file__))
  env_path = os.path.join(root_dir, ".env")
  if not os.path.exists(env_path):
    return
  try:
    with open(env_path, "r", encoding="utf-8") as f:
      for line in f:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
          continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
          os.environ[key] = value
  except Exception:
    pass


_load_env_from_dotenv()


def _load_env_from_streamlit_secrets() -> None:
  """On Streamlit Community Cloud, secrets are in st.secrets (not .env)."""
  try:
    for key in ("INSFORGE_URL", "INSFORGE_BASE_URL", "INSFORGE_KEY", "ANON_KEY"):
      if key not in os.environ and hasattr(st, "secrets") and st.secrets and key in st.secrets:
        val = st.secrets.get(key)
        if val is not None and str(val).strip():
          os.environ[key] = str(val).strip()
  except Exception:
    pass


_load_env_from_streamlit_secrets()

API_BASE_URL = os.environ.get("INSFORGE_URL") or os.environ.get("INSFORGE_BASE_URL") or ""
FUNCTIONS_BASE = API_BASE_URL.rstrip("/") + "/functions" if API_BASE_URL else ""


def _init_session_state() -> None:
  if "tasks" not in st.session_state:
    st.session_state.tasks = []
  if "run_id" not in st.session_state:
    st.session_state.run_id = None
  if "result_slot" not in st.session_state:
    st.session_state.result_slot = None
  if "run_task_id" not in st.session_state:
    st.session_state.run_task_id = None
  if "saved_message" not in st.session_state:
    st.session_state.saved_message = None
  if "status_message" not in st.session_state:
    st.session_state.status_message = None
  if "pending_start" not in st.session_state:
    st.session_state.pending_start = False
  if "saving_task" not in st.session_state:
    st.session_state.saving_task = False


def _get_auth_header() -> Dict[str, str]:
  anon_key = os.environ.get("INSFORGE_KEY") or os.environ.get("ANON_KEY") or ""
  return {"Authorization": f"Bearer {anon_key}"} if anon_key else {}


def _fetch_tasks() -> None:
  if not FUNCTIONS_BASE:
    return
  try:
    resp = requests.get(f"{FUNCTIONS_BASE}/tasks", headers=_get_auth_header(), timeout=15)
    if resp.ok:
      data = resp.json()
      st.session_state.tasks = data.get("tasks") or []
  except Exception:
    pass


def _call_start_run(payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
  if not FUNCTIONS_BASE:
    return {"error": "Missing INSFORGE_URL/INSFORGE_BASE_URL environment variable."}
  try:
    resp = requests.post(
      f"{FUNCTIONS_BASE}/start-run",
      headers={**_get_auth_header(), "Content-Type": "application/json"},
      json=payload,
      timeout=30,
    )
    if not resp.ok:
      try:
        body = resp.json()
        err = body.get("error", resp.text or f"HTTP {resp.status_code}")
        # Pass through Apify error fields for display
        return {
          "error": err,
          "apifyStatus": body.get("apifyStatus"),
          "details": body.get("details"),
          "actorId": body.get("actorId"),
        }
      except Exception:
        return {"error": resp.text or f"HTTP {resp.status_code}"}
    return resp.json()
  except Exception as e:
    return {"error": "Failed to start run", "details": str(e)}


def _poll_once(run_id: str) -> tuple[Dict[str, Any], Optional[str]]:
  """Poll get-result once. Returns (result_dict, status_message or None if done)."""
  if not FUNCTIONS_BASE:
    return ({"error": "Missing INSFORGE_URL/INSFORGE_BASE_URL environment variable."}, None)
  url = f"{FUNCTIONS_BASE}/get-result"
  try:
    resp = requests.post(
      url,
      headers={**_get_auth_header(), "Content-Type": "application/json"},
      json={"runId": run_id},
      timeout=30,
    )
  except Exception as e:
    return ({"error": "Failed to get result", "details": str(e)}, None)
  if not resp.ok:
    return ({"error": "Failed to get result", "details": resp.text}, None)
  data = resp.json()
  status = data.get("status")
  if status == "running":
    return (data, "Waiting for Apify run to finish…")
  if status == "completed":
    return (data, None)
  if status == "failed":
    return ({"error": data.get("error", "Run failed")}, None)
  return (data, "Checking status…")


def _poll_result(run_id: str) -> Dict[str, Any]:
  """Poll until completed or failed (used for task run from sidebar)."""
  for _ in range(60):
    result, _ = _poll_once(run_id)
    if result.get("error") and not result.get("status"):
      return result
    status = result.get("status")
    if status == "running":
      time.sleep(2)
      continue
    return result
  return {"error": "Polling timed out"}


def main() -> None:
  st.set_page_config(page_title="Monid", layout="wide")
  st.markdown("""
    <style>
    /* Hide top-right "Running" animation – status is shown below search only */
    div[data-testid="stStatusWidget"] { display: none !important; }
    /* No box around search */
    [data-testid="stForm"] { border: none; padding: 0; background: transparent; }
    [data-testid="stForm"] .stTextInput input { font-size: 1.1rem; padding: 0.75rem 1rem; min-height: 2.5rem; }
    /* Output schema: small, subtle */
    [data-testid="stExpander"] summary { font-size: 0.875rem; padding: 0.25rem 0; }
    [data-testid="stExpander"] .streamlit-expanderContent { padding-top: 0.25rem; }
    /* Status block below search */
    .monid-status { padding: 0.75rem 1rem; border-radius: 6px; background: var(--background-secondary, #f0f2f6); font-size: 0.95rem; }
    .monid-status-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--primary-color, #ff4b4b); margin-right: 0.5rem; animation: monid-pulse 1.2s ease-in-out infinite; }
    @keyframes monid-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    </style>
    """, unsafe_allow_html=True)
  _init_session_state()
  if FUNCTIONS_BASE:
    _fetch_tasks()

  run_task_id = st.session_state.get("run_task_id")
  if run_task_id:
    start_resp = _call_start_run({"taskId": run_task_id})
    st.session_state.run_task_id = None
    if start_resp and not start_resp.get("error"):
      rid = start_resp.get("runId")
      if rid:
        result = _poll_result(rid)
        if result.get("status") == "completed":
          st.session_state.result_slot = {
            "data": result.get("data"),
            "cost": result.get("cost"),
            "from_task": True,
          }
        else:
          st.session_state.result_slot = {"error": result.get("error", "Run failed")}
      else:
        st.session_state.result_slot = {"error": "No runId returned"}
    else:
      err = (start_resp or {}).get("error", "Failed to start run")
      st.session_state.result_slot = {
        "error": err,
        "details": (start_resp or {}).get("details"),
        "apifyStatus": (start_resp or {}).get("apifyStatus"),
        "actorId": (start_resp or {}).get("actorId"),
      }
    st.rerun()

  with st.sidebar:
    st.write("**Tasks**")
    for t in st.session_state.tasks:
      label = t.get("description") or t.get("name") or t.get("id", "")
      if st.button(label, key=f"task_{t.get('id')}"):
        st.session_state.run_task_id = t.get("id")
        st.rerun()

  with st.form("search_form", border=False):
    query = st.text_input("Search", placeholder="e.g. top 10 cafes in Boston", label_visibility="collapsed")
    with st.expander("Output schema (optional)"):
      schema_raw = st.text_area(
        "JSON",
        value="",
        height=60,
        placeholder='{"name": "string", "rating": "number", "address": "string"}',
        label_visibility="collapsed",
      )
    submitted = st.form_submit_button("Search")
  result_slot = st.session_state.get("result_slot")
  if submitted and query and query.strip():
    parsed = None
    if schema_raw.strip():
      try:
        parsed = json.loads(schema_raw)
      except json.JSONDecodeError:
        st.session_state.result_slot = {"error": "Output schema must be valid JSON."}
        st.rerun()
    # Show status bar immediately; call backend on next run.
    st.session_state.result_slot = "loading"
    st.session_state.status_message = "Sending request…"
    st.session_state.last_request = query.strip()
    st.session_state.last_output_schema = parsed
    st.session_state.pending_start = True
    st.rerun()

  if result_slot == "loading":
    msg = st.session_state.get("status_message") or "Running…"
    st.markdown(
      f'<div class="monid-status"><span class="monid-status-dot"></span>{msg}</div>',
      unsafe_allow_html=True,
    )
    run_id = st.session_state.get("run_id")
    if st.session_state.get("pending_start"):
      st.session_state.pending_start = False
      payload = {"request": st.session_state.get("last_request", "")}
      if st.session_state.get("last_output_schema") is not None:
        payload["outputSchema"] = st.session_state["last_output_schema"]
      start_resp = _call_start_run(payload)
      if start_resp and not start_resp.get("error") and start_resp.get("runId"):
        st.session_state.run_id = start_resp["runId"]
        st.session_state.status_message = "Starting run…"
        st.rerun()
      else:
        err = (start_resp or {}).get("error", "Failed to start run")
        st.session_state.result_slot = {
          "error": err,
          "details": (start_resp or {}).get("details"),
          "apifyStatus": (start_resp or {}).get("apifyStatus"),
          "actorId": (start_resp or {}).get("actorId"),
        }
        st.session_state.status_message = None
        st.rerun()
    if run_id:
      if msg == "Starting run…":
        st.session_state.status_message = "Checking status…"
        st.rerun()
      result, status_msg = _poll_once(run_id)
      if status_msg is not None:
        st.session_state.status_message = status_msg
        time.sleep(1)
        st.rerun()
      st.session_state.run_id = None
      st.session_state.status_message = None
      if result.get("status") == "completed":
        st.session_state.result_slot = {
          "data": result.get("data"),
          "cost": result.get("cost"),
          "request": st.session_state.get("last_request"),
          "output_schema": st.session_state.get("last_output_schema"),
        }
      else:
        st.session_state.result_slot = {"error": result.get("error", "Run failed")}
      st.rerun()
    st.stop()

  if isinstance(result_slot, dict):
    if "error" in result_slot:
      st.error(result_slot["error"])
      # Show Apify error code and details when start-run fails
      err_parts = []
      if result_slot.get("apifyStatus") is not None:
        err_parts.append(f"**Apify status:** `{result_slot['apifyStatus']}`")
      if result_slot.get("actorId"):
        err_parts.append(f"**Actor:** `{result_slot['actorId']}`")
      if err_parts:
        st.markdown(" | ".join(err_parts))
      if result_slot.get("details"):
        st.text(result_slot["details"])
    else:
      data = result_slot.get("data")
      cost = result_slot.get("cost")
      if isinstance(cost, dict):
        if cost.get("providerUsd") is not None:
          st.caption(f"Cost: ${cost['providerUsd']:.4f} USD")
        elif cost.get("unavailable"):
          st.caption("Cost: unavailable")
      if isinstance(data, list) and data:
        st.dataframe(data)
      elif data is not None:
        st.json(data)

      if "request" in result_slot and "from_task" not in result_slot:
        if st.session_state.get("saving_task"):
          st.markdown(
            '<div class="monid-status"><span class="monid-status-dot"></span>Saving task…</div>',
            unsafe_allow_html=True,
          )
          save_payload = {
            "request": result_slot["request"],
            "saveAsTask": True,
          }
          if result_slot.get("output_schema") is not None:
            save_payload["outputSchema"] = result_slot["output_schema"]
          save_resp = _call_start_run(save_payload)
          st.session_state.saving_task = False
          if save_resp and save_resp.get("taskId"):
            st.session_state.saved_message = "Task saved."
            _fetch_tasks()
          else:
            err = (save_resp or {}).get("error", "Failed to save task")
            st.session_state.result_slot = {
              "error": err,
              "details": (save_resp or {}).get("details"),
              "apifyStatus": (save_resp or {}).get("apifyStatus"),
              "actorId": (save_resp or {}).get("actorId"),
            }
          st.rerun()
        elif st.button("Save task for future use"):
          st.session_state.saving_task = True
          st.rerun()
        if st.session_state.get("saved_message"):
          st.success(st.session_state.saved_message)
          st.session_state.saved_message = None


if __name__ == "__main__":
  main()
