"""Off-PC watchdog: the trading PC writes beat.txt (its last upload's UTC time) into the status gist every minute. If that time is
older than STALE_MIN, the PC is off, crashed, frozen, waiting at the sign-in screen, offline, or its status loop died: tell
Telegram, remind every REMIND_MIN, and say when it's back. State (down or not) lives in state.json on the `watchdog` branch.

    python3 watchdog.py <state.json>      env: BEAT_URL, TG_TOKEN, TG_CHAT
Reads only the timestamp; it cannot see any account data (that file is encrypted)."""
import datetime as dt, json, os, sys, urllib.request

STALE_MIN, REMIND_MIN = 15, 120


def send(text):
    body = json.dumps(dict(chat_id=os.environ["TG_CHAT"], text=text, parse_mode="HTML")).encode()
    urllib.request.urlopen(urllib.request.Request(f"https://api.telegram.org/bot{os.environ['TG_TOKEN']}/sendMessage", data=body,
                                                  headers={"Content-Type": "application/json"}), timeout=20)


def main(path):
    st = json.load(open(path)) if os.path.exists(path) and os.path.getsize(path) else {}
    now = dt.datetime.now(dt.timezone.utc)
    try:
        url = os.environ["BEAT_URL"] + f"?t={int(now.timestamp())}"
        beat = dt.datetime.strptime(urllib.request.urlopen(url, timeout=20).read().decode().strip(), "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=dt.timezone.utc)
    except Exception as e:
        print("beat not read, nothing decided:", e); return
    age = (now - beat).total_seconds() / 60; print(f"last beat {beat:%Y-%m-%d %H:%M} UTC, {age:.0f} min ago, state {st}")
    if age > STALE_MIN:
        last = dt.datetime.fromisoformat(st["told"]) if st.get("told") else None
        if not st.get("down"):
            send(f"🛑 <b>Trading PC silent</b> since {beat:%a %H:%M} UTC ({age:.0f} min).\nIt is off, crashed, frozen, at the sign-in screen or offline: "
                 "no EA is trading. Log in, press Start Trading, then check Go Live.")
            st = dict(down=True, since=beat.isoformat(), told=now.isoformat())
        elif last and (now - last).total_seconds() / 60 >= REMIND_MIN:
            send(f"⏰ <b>Trading PC still silent</b>: nothing since {beat:%a %H:%M} UTC ({age / 60:.1f} h).")
            st["told"] = now.isoformat()
    elif st.get("down"):
        since = dt.datetime.fromisoformat(st["since"])
        send(f"✅ <b>Trading PC reporting again</b> at {beat:%H:%M} UTC, after {(beat - since).total_seconds() / 60:.0f} min silent.\n"
             "The PC's own messages say which terminals or EAs still need opening.")
        st = {}
    json.dump(st, open(path, "w"))


if __name__ == "__main__":
    main(sys.argv[1])
