# Flask DBGR Hook
## Replace flask werkzeug debugger with dbgr

[![](https://raw.github.com/CHANGEME/dbgr/master/flask_wdb_hook/demo.gif)](https://raw.github.com/CHANGEME/dbgr/master/flask_wdb_hook/demo.gif)


### Installation

```bash
    $ sudo pip install flask-dbgr-hook
    $ export FLASK_DBGR=1
```

### How does it work

This package only install a pth file in the site-packages directory which calls:
```python
import dbgr; \
from dbgr.ext import DbgrMiddleware; \
from werkzeug import debug; \
debug.DebuggedApplication = DbgrMiddleware  # This is so much a hack
```

As pth files contain either import path or python import statement, we abuse the import evaluation to patch the werkzeug debugger in the same statement.

Et voilà.
