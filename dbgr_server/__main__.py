# Stdlib:
import asyncio
import argparse
from logging import DEBUG, INFO, WARNING, getLogger

# Thirdparty:
import uvicorn

# Firstparty:
from dbgr_server.app import init_app


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--debug", action="store_true")
    parser.add_argument("--extra-search-path", action="store_true")
    parser.add_argument("--more", action="store_true")
    parser.add_argument("--detached_session", action="store_true")
    parser.add_argument("--show-filename", action="store_true")
    parser.add_argument("--server-host", type=str, default="localhost")
    parser.add_argument("--server-port", type=int, default=1984)
    parser.add_argument("--socket-host", type=str, default="localhost")
    parser.add_argument("--socket-port", type=int, default=19840)
    args = parser.parse_args()

    log = getLogger("dbgr_server")
    if args.debug:
        log.setLevel(INFO)
        if args.more:
            log.setLevel(DEBUG)
    else:
        log.setLevel(WARNING)

    try:
        import uvloop  # pylint: disable=import-outside-toplevel
        uvloop.install()
    except ImportError:  # pragma: no cover
        pass

    settings = {
        "debug": args.debug,
        "extra_search_path": args.extra_search_path,
        "more": args.more,
        "detached_session": args.detached_session,
        "show_filename": args.show_filename,
        "socket_host": args.socket_host,
        "socket_port": args.socket_port,
    }

    app = asyncio.run(init_app(settings))

    uvicorn.run(
        app,
        host=args.server_host,
        port=args.server_port,
        loop="none",  # event loop already configured
    )


if __name__ == "__main__":
    main()
