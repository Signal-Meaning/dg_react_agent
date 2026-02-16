# Message to voice-commerce (copy & send)

---

**Subject:** Fix for `conversation_already_has_active_response` — please upgrade to v0.9.2 / 0.2.2

---

Hi,

We’ve shipped a patch that fixes the path that was still causing `conversation_already_has_active_response` on 0.9.1 / 0.2.1.

**Please upgrade to:**
- **@signal-meaning/voice-agent-react@0.9.2**
- **@signal-meaning/voice-agent-backend@0.2.2**

**What was wrong:** The proxy was clearing “response in progress” when it received `response.output_audio.done`. The API can send audio.done before text.done, so a Settings → session.update could still go through while the API had an active response and trigger the error.

**What we changed:** The proxy now clears “response in progress” only when it receives `response.output_text.done`, so it doesn’t send session.update until the full response is done.

**What we’d like you to do:** Upgrade, re-run your flow (including your E2E), and confirm the error is gone. If you still see it, a proxy log excerpt with `LOG_LEVEL=debug` from connect through the error would help us check for any other paths.

Release: https://github.com/Signal-Meaning/dg_react_agent/releases/tag/v0.9.2  
Docs: https://github.com/Signal-Meaning/dg_react_agent/tree/main/docs/issues/ISSUE-462

Thanks,  
[Your name]
