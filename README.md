# dbgr - Web Debugger

## PyPI

[![PyPI - dbgr](https://img.shields.io/pypi/v/dbgr?label=dbgr&style=flat-square)](https://pypi.org/project/dbgr)
[![PyPI - dbgr-server](https://img.shields.io/pypi/v/dbgr-server?label=dbgr-server&style=flat-square)](https://pypi.org/project/dbgr-server)
[![Python Versions](https://img.shields.io/pypi/pyversions/dbgr-server?logo=python&style=flat-square)](https://pypi.org/project/dbgr-server)

## GitHub

[![GitHub last commit](https://img.shields.io/github/last-commit/arkhan/dbgr?style=flat-square)](https://github.com/arkhan/dbgr/commits/master)
[![License](https://img.shields.io/github/license/arkhan/dbgr?style=flat-square)](https://github.com/arkhan/dbgr/blob/master/LICENSE)

# About this project

**dbgr** is a full featured web debugger based on a client-server architecture,
similar in spirit to [pudb](https://github.com/inducer/pudb) but running as a web
application instead of a terminal UI. It lets you step through code, inspect
locals/globals in a live tree view, set breakpoints, and evaluate Python
expressions, all from your browser.

This project is a continuation of the original [`wdb`](https://github.com/Kozea/wdb)
client/server debugger by Florian Mounier (Kozea), and of
[`wdb_server_aiohttp`](https://github.com/shepilov-vladislav/wdb_server_aiohttp),
Shepilov Vladislav's `aiohttp`-based rewrite of the original `tornado` server.
Both of those projects had gone stale (last releases several years old, built
on stacks that have since been deprecated), so **dbgr** picks up where they
left off: the server was migrated from `aiohttp` to `FastAPI`, the frontend
editor was upgraded from CodeMirror 5 to CodeMirror 6, and a pudb-style
variables/watches panel was added next to the source and console panes.

This is an actively maintained fork meant to keep the project usable on
current Python and browser versions. Contributions, bug reports, and ideas
for where to take it next are welcome — see [Contribute](#contribute) below.

# What changed from the original `wdb`/`wdb_server_aiohttp`

- `aiohttp` -> `FastAPI` / `uvicorn` server
- CodeMirror 5 -> CodeMirror 6 editor
- Added a pudb-style variables/watches panel (locals, globals, and expandable
  containers) next to the source and console panes
- `tornado` -> `aiohttp` (inherited from `wdb_server_aiohttp`) -> `FastAPI`
- Coffeescript -> Typescript
- Bower -> npm/yarn
- Grunt -> Webpack
- yapf -> black
- Support for themes on any screen size
- Support for Safari
- Works without internet access (the original project required Google Fonts
  from a CDN)
- Renamed packages/imports: `wdb` -> `dbgr`, `wdb.server` -> `dbgr-server`

# Description

**dbgr** is a full featured web debugger based on a client-server architecture.

The dbgr server, which is responsible for managing debugging instances along
with browser connections (through websockets), is based on
[FastAPI](https://fastapi.tiangolo.com/). The dbgr client allows step by step
debugging, in-program python code execution, code edition (based on
[CodeMirror](https://codemirror.net/)), and setting breakpoints.

Due to this architecture, all of this is fully compatible with **multithread**
and **multiprocess** programs.

**dbgr** works with Python 3. It is possible to debug a program running on
one computer with a debugging server running on another computer, inside a
web page on a third computer.

It is also possible to pause a currently running python process/thread using
code injection from the web interface (this requires `gdb` and `ptrace`
enabled).

In other words, it's a very enhanced version of `pdb` directly in your
browser, with nice features.

## Installation

Install the server (this pulls in the web interface and the debugging
protocol server):

```bash
$ pip install dbgr-server
```

In each virtualenv/interpreter you want to debug, install the client:

```bash
$ pip install dbgr
```

(You must have the server installed and running somewhere reachable from the
process you're debugging.)

## Quick test

To try dbgr, first start the dbgr server:

```bash
$ dbgr.server.py &
```

Next run:

```bash
$ python -m dbgr your_file.py
```

Dbgr will open a debugging window right in your browser, paused at the
beginning of your program.

You can access <http://localhost:1984/> to have an overview of the server.

NB: You have to start the server only once. Multiple debugging sessions can
be run simultaneously without problem.

This is not the only way to debug a program, see below.

## Usage

### Setting trace

To debug any program, with the server on, just add:

```python
import dbgr
dbgr.set_trace()
```

anywhere in your code. Your program will stop at the `set_trace` line (just
like `pdb`).

### Tracing code

To inspect your code on exception, you can do the following:

```python
from dbgr import trace
with trace():
    wrong_code()
```

Any exception during `wrong_code` will launch a debugging session.

You can also use the `start_trace()` and `stop_trace()` methods (put
`stop_trace` in a `finally` block to avoid tracing the rest of your program
after an exception).

### Debugging web servers

dbgr provides some tools to make it work nicely with different web servers:

#### WSGI servers

For WSGI servers you can use the `DbgrMiddleware`:

```python
from dbgr.ext import DbgrMiddleware
wsgi_app = Whatever_wsgi_server_lib()
my_app = DbgrMiddleware(wsgi_app)
my_app.serve_forever()
```

##### Flask

```python
from flask import Flask
from dbgr.ext import DbgrMiddleware
app = Flask(__name__)
app.debug = True
app.wsgi_app = DbgrMiddleware(app.wsgi_app)
app.run(use_debugger=False)  # Disable builtin Werkzeug debugger
```

##### Django

Add the middleware in your `wsgi.py`, after:

```python
from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
```

add:

```python
from dbgr.ext import DbgrMiddleware
application = DbgrMiddleware(application)
```

And in your `settings.py`, activate exception propagation:

```python
DEBUG = True
DEBUG_PROPAGATE_EXCEPTIONS = True
```

##### CherryPy

```python
import cherrypy
from dbgr.ext import DbgrMiddleware

class HelloWorld(object):
    @cherrypy.expose
    def index(self):
        undefined_method()  # This will fail
        return "Hello World!"

cherrypy.config.update({'global': {'request.throw_errors': True}})
app = cherrypy.Application(HelloWorld())
app.wsgiapp.pipeline.append(('debugger', DbgrMiddleware))

cherrypy.quickstart(app)
```

#### Tornado

In Tornado, which is not a WSGI server, you can use the `dbgr_tornado`
function, which will monkey-patch the `execute` method on `RequestHandler`s:

```python
from dbgr.ext import dbgr_tornado
from tornado.web import Application
my_app = Application([(r"/", MainHandler)])
if options.debug:
    dbgr_tornado(my_app)
my_app.listen(8888)
```

#### Page loading time becomes slow

If dbgr slows down your application too much (tracing everything takes
time), you can start it disabled with:

```python
my_app = DbgrMiddleware(wsgi_app, start_disabled=True)  # or
dbgr_tornado(my_app, start_disabled=True)
```

Then when you get an exception just click on the on/off button.

## Remote debugging

You can easily do remote debugging with dbgr:

Let's say you want to run a program `p.py` on computer A and you want to
debug it on computer B.

Start the dbgr server on computer A and launch this:

```bash
DBGR_NO_BROWSER_AUTO_OPEN=True python -m dbgr p.py
```

And open a browser on computer B at the url given by the dbgr log.

Now you can also run the dbgr server on a computer C and run on computer A:

```bash
DBGR_NO_BROWSER_AUTO_OPEN=True DBGR_SOCKET_SERVER=computerC.addr DBGR_SOCKET_PORT=19840 python -m dbgr p.py
```

And go with computer B to `http://computerC/debug/session/[uuid in log]`,
where you can step into `p.py` running on computer A.

You can use different configurations. See `dbgr.server.py --help` for
changing ports on the server, and these environment variables for dbgr
instances:

```
DBGR_SOCKET_SERVER         # dbgr server host
DBGR_SOCKET_PORT           # dbgr server socket port
DBGR_WEB_SERVER            # dbgr server host for browser opening
DBGR_WEB_PORT               # dbgr server http port
DBGR_NO_BROWSER_AUTO_OPEN  # Disable automatic browser opening (needed if the browser is not on the same machine)
```

### Docker / Podman

This repo ships a `Containerfile` (works with both `podman build` and
`docker build -f Containerfile`) and a `compose.yml` to run the dbgr server
in a container.

Quick start:

```bash
$ podman compose up --build     # or: docker compose up --build
```

This builds the image and starts the `dbgr-server` service, publishing:

- `1984` — the web UI (open `http://localhost:1984` to see running sessions)
- `19840` — the socket port dbgr clients connect to

Or build/run it manually without compose:

```bash
$ podman build -f Containerfile -t dbgr-server .
$ podman run --rm -p 1984:1984 -p 19840:19840 dbgr-server
```

The basic setup for debugging an app that runs in its own container looks
like this:

1. Start the `dbgr-server` container (via `compose.yml` or manually), with
   port `1984` published to your host — this serves the debugging web UI.
2. In your app container, install the `dbgr` client (`pip install dbgr`) and
   set the `DBGR_*` environment variables below so it can reach the
   `dbgr-server` container over the socket port (`19840`).
3. When a trace is reached, open the URL dbgr prints (or
   `http://localhost:1984` directly) to step through the code.

#### Environment variables

These are read by the **`dbgr` client** (the library you `pip install` and
`import` in the process you're debugging) — set them on whatever container
runs your application, not on `dbgr-server` itself:

| Variable | Default | Meaning |
|---|---|---|
| `DBGR_SOCKET_SERVER` | `localhost` | Host of the `dbgr-server` socket endpoint the client connects to. In `compose.yml`, use the service name (e.g. `dbgr-server`) so it resolves inside the docker network. |
| `DBGR_SOCKET_PORT` | `19840` | Port of that socket endpoint. |
| `DBGR_WEB_SERVER` | *(falls back to `DBGR_SOCKET_SERVER`)* | Host used to build the "open this in your browser" link. Set this to whatever hostname *your browser* can resolve (usually `localhost` if ports are published to the host) — it does **not** need to match `DBGR_SOCKET_SERVER`. |
| `DBGR_WEB_PORT` | `1984` | Port of the dbgr-server web UI, used in that same link. |
| `DBGR_NO_BROWSER_AUTO_OPEN` | `False` | Set to `True` inside containers — there's no browser to auto-open, and dbgr will otherwise try (and fail) to launch one. Use the printed URL instead. |
| `DBGR_LOG` | `WARNING` | Log level for all dbgr client loggers. |
| `DBGR_<NAME>_LOG` | `DBGR_LOG` | Per-logger override; `NAME` is one of `MAIN`, `TRACE`, `UI`, `EXT`, `BP` (e.g. `DBGR_TRACE_LOG=DEBUG`). |

`compose.yml` includes a commented-out example `app` service showing how to
wire these up against the `dbgr-server` service defined next to it.

Example minimal `docker-compose.yml`, starting from
[the official example for using Docker with Django](https://docs.docker.com/compose/django/):

```yaml
services:
  db:
    image: postgres
  web:
    build: .
    command: python manage.py runserver 0.0.0.0:8000
    volumes:
      - .:/code
    ports:
      - "8000:8000"
    depends_on:
      - db
      - dbgr-server
    environment:
      DBGR_SOCKET_SERVER: dbgr-server
      DBGR_WEB_SERVER: localhost
      DBGR_NO_BROWSER_AUTO_OPEN: "True"
  dbgr-server:
    build:
      context: .
      dockerfile: Containerfile
    ports:
      - "1984:1984"
      - "19840:19840"
```

Add `dbgr` to your `requirements.txt` in your web app:

```bash
$ echo 'dbgr' >> requirements.txt
```

Now you can use `dbgr.set_trace()` in your python app:

```python
# ... some code
import dbgr
dbgr.set_trace()
```

Then rebuild your web application and start everything up again:

```bash
$ podman compose stop
$ podman compose up --build
```

Now you can access `http://localhost:1984` to see the traces as they come up
in your app.


## In browser usage

Once you are in a breakpoint or in an exception, you can eval anything you
want in the prompt under the code. Multi-lines are partially supported using
`[Shift] + [Enter]`. There is help available by clicking the top help button.

As of now, the following special commands are supported during a breakpoint:

```
.s or [Ctrl] + [↓] or [F11]    : Step into
.n or [Ctrl] + [→] or [F10]    : Step over (Next)
.r or [Ctrl] + [↑] or [F9]     : Step out (Return)
.c or [Ctrl] + [←] or [F8]     : Continue
.u or [F7]                     : Until (Next over loops)
.j lineno                      : Jump to lineno (must be at bottom frame and in the same function)
.b arg                         : Set a session breakpoint, see below for what arg can be
.t arg                         : Set a temporary breakpoint, arg follows the same syntax as .b
.z arg                         : Delete existing breakpoint
.l                             : List active breakpoints
.f                             : Echo all typed commands in the current debugging session
.d expression                  : Dump the result of expression in a table
.w expression                  : Watch expression in current file (click on the name to remove)
.q                             : Quit
.h                             : Get some help
.e                             : Toggle file edition mode
.g                             : Clear prompt
.i [mime/type;]expression      : Display the result in an embed; mime type is auto-detected on Linux and defaults to "text/html" otherwise
iterable!sthg                  : If cutter is installed, executes cut(iterable).sthg
expr >! file                   : Write the result of expr in file
!< file                        : Eval the content of file
[Enter]                        : Eval the current selected text on the page, useful to eval code in the source

* arg follows this syntax:
    [file/module][:lineno][#function][,condition]
  which means:
    - [file]                    : Break if any line of `file` is executed
    - [file]:lineno             : Break on `file` at `lineno`
    - [file][:lineno],condition : Break on `file` at `lineno` if `condition` is True (e.g.: i == 10)
    - [file]#function           : Break when inside `function`
  File is always the current file by default; you can also specify a module
  like `logging.config`.
```

You can also eval a variable in the source by middle-clicking on it. You can
add/remove a breakpoint by clicking on the line number.

NB: Hotkeys with arrows are purposely not triggered in the eval prompt, to
avoid conflicts when typing.

## Dbgr Server

To see which debugging sessions are currently open, open your browser at
<http://localhost:1984/>. You can also close crashed sessions.

From there you should also see all Python processes and their threads
running, and you can try to pause them during execution to do step by step
debugging and current variable inspection. **This is highly experimental and
requires gdb and a kernel with ptrace enabled to inject python code into a
running python process.** If you get `ptrace: Operation not permitted.` you
will have to enable it.

Depending on your system it might work with:

```bash
$ echo 0 | sudo tee /proc/sys/kernel/yama/ptrace_scope
```

Make sure that `dbgr` is installed for the python version running the
program too.

## Importing dbgr each time is exhausting

To avoid that, you can add a `w` builtin at the beginning of your
application:

```python
from dbgr.ext import add_w_builtin
add_w_builtin()
```

you can now use the `w` object anywhere in your code:

```python
my_code()
w.tf  # Stop next line
doubtful_code()
```

```python
my_code()
with w.trace():
    doubtful_code()
```

## Code completion

dbgr has dynamic code completion in the eval prompt thanks to
[jedi](https://github.com/davidhalter/jedi).

## FAQ

### In Firefox opened debugging pages are not closed when done

It's a Firefox config flag; visit `about:config` and set
`dom.allow_scripts_to_close_windows` to `true`.

### The logs are spammed with 'parsing Python module'

If your logging configuration is set to display DEBUG logs, you may see a log
for every imported file in your project any time dbgr is active, like so:

```
DEBUG 2017-07-16 13:15:03,772 index 49835 123145573191680 parsing Python module /project/.virtualenv/python-3.6.1/lib/python3.6/site-packages/package/file.py for indexing
```

To silence only this message, add a config for the `importmagic` module. For
example:

```python
LOGGING = {
    ...
    'loggers': {
        ...
        'importmagic.index': {
            'level': 'ERROR',
            'propagate': False,
        },
    },
}
```

## Contribute

This project picks up an old, abandoned debugger and brings it back to a
modern stack, but there's plenty left to do (see `TODO.org`): finishing the
CodeMirror 6 migration polish, expanding the variables/watches panel,
covering the frontend with unit tests, adding frontend/backend integration
tests, and multithread/multiprocess/async debugging support are all open.
All contributions are more than welcome — fork it and send a PR.

## Author

* [Florian Mounier](http://github.com/paradoxxxzero) @ [Kozea](http://kozea.fr/) — original author of `wdb`
* [Shepilov Vladislav](https://github.com/shepilov-vladislav) — author of `wdb_server_aiohttp`
* [arkhan](https://github.com/arkhan) — current maintainer of `dbgr`

## License

This library is licensed under GPLv3
