#!/usr/bin/env python3
"""Control a running local Communion backend without opening the interface."""

import argparse
import json
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8010")
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("status", "sessions"):
        commands.add_parser(name)
    create = commands.add_parser("create", help="Create a paused world from a scenario ID")
    create.add_argument("scenario_id")
    create.add_argument("--name", default="")
    for name in ("start", "pause", "recap"):
        commands.add_parser(name).add_argument("session_id")
    say = commands.add_parser("say", help="Contribute through an in-world identity")
    say.add_argument("session_id")
    say.add_argument("text")
    identity = say.add_mutually_exclusive_group()
    identity.add_argument("--name", default="Anonymous voice")
    identity.add_argument("--character", help="Speak as an existing character ID")
    api = commands.add_parser("api", help="Call any local JSON API route")
    api.add_argument("method", choices=["GET", "POST", "PUT"])
    api.add_argument("path", help="For example /bootstrap or /sessions/ID/logs")
    body = api.add_mutually_exclusive_group()
    body.add_argument("--json", help="JSON request body")
    body.add_argument("--file", help="JSON file, or - to read stdin")
    args = parser.parse_args()

    base = urlparse(args.url)
    if (
        base.scheme != "http"
        or base.hostname not in ("localhost", "127.0.0.1", "::1")
        or base.username or base.password or base.query or base.fragment
        or base.path not in ("", "/")
    ):
        parser.error("Use a local HTTP origin, such as http://127.0.0.1:8010")
    method, body = "GET", None
    if args.command == "status":
        path = "/health"
    elif args.command == "sessions":
        path = "/sessions"
    elif args.command == "create":
        method, path = "POST", "/sessions"
        body = {"scenario_id": args.scenario_id, "name": args.name}
    elif args.command in ("start", "pause", "recap"):
        suffix = "recaps" if args.command == "recap" else args.command
        method, path, body = "POST", f"/sessions/{args.session_id}/{suffix}", {}
    elif args.command == "say":
        method, path = "POST", f"/sessions/{args.session_id}/messages"
        body = {"text": args.text, "name": args.name}
        if args.character:
            body["author_id"] = args.character
    else:
        method, path = args.method, args.path
        try:
            if args.json is not None:
                body = json.loads(args.json)
            elif args.file:
                if args.file == "-":
                    body = json.load(sys.stdin)
                else:
                    with open(args.file) as handle:
                        body = json.load(handle)
        except (ValueError, OSError) as error:
            parser.error(f"Cannot read JSON body: {error}")
    if not path.startswith("/") or path.startswith("//") or "#" in path:
        parser.error("Use an API path starting with a single /")
    if path.startswith("/api/"):
        path = path[4:]
    request = Request(
        args.url.rstrip("/") + "/api" + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method=method,
    )
    try:
        with urlopen(request, timeout=120) as response:
            print(json.dumps(json.load(response), indent=2, ensure_ascii=False))
    except HTTPError as error:
        print(f"HTTP {error.code}: {error.read().decode()}", file=sys.stderr)
        return 1
    except (URLError, TimeoutError) as error:
        print(f"Cannot reach Communion: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
