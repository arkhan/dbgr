# -*- coding: latin-1 -*-
import sys


def u(s):
    """Python 3.2..."""
    if sys.version_info[0] == 2:
        return s.decode('latin-1')
    return s

print(u('éàç'))

import dbgr
dbgr.set_trace()
