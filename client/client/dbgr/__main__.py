import argparse
import os
import sys

from dbgr import Dbgr
from dbgr._compat import execute

parser = argparse.ArgumentParser(description='Dbgr, the web python debugger.')
parser.add_argument(
    '--source',
    dest='source',
    help='Source the specified file before openning the shell',
)

parser.add_argument(
    '--trace',
    dest='trace',
    action='store_true',
    help='Activate trace (otherwise just inspect tracebacks).',
)
parser.add_argument('file', nargs='?', help='the path to the file to debug.')
parser.add_argument('args', nargs='*', help='arguments to the debugged file.')


def main():
    """Dbgr entry point"""
    sys.path.insert(0, os.getcwd())
    args, extrargs = parser.parse_known_args()
    sys.argv = ['dbgr'] + args.args + extrargs

    if args.file:
        file = os.path.join(os.getcwd(), args.file)
        if args.source:
            print('The source argument cannot be used with file.')
            sys.exit(1)

        if not os.path.exists(file):
            print('Error:', file, 'does not exist')
            sys.exit(1)
        if args.trace:
            Dbgr.get().run_file(file)
        else:

            def dbgr_pm(xtype, value, traceback):
                sys.__excepthook__(xtype, value, traceback)
                dbgr = Dbgr.get()
                dbgr.reset()
                dbgr.interaction(None, traceback, post_mortem=True)

            sys.excepthook = dbgr_pm

            with open(file) as f:
                code = compile(f.read(), file, 'exec')
                execute(code, globals(), globals())

    else:
        source = None
        if args.source:
            source = os.path.join(os.getcwd(), args.source)
            if not os.path.exists(source):
                print('Error:', source, 'does not exist')
                sys.exit(1)

        Dbgr.get().shell(source)


if __name__ == '__main__':
    main()
