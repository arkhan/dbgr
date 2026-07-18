"""Dbgr plugin for pytest."""
import dbgr


def pytest_addoption(parser):
    parser.addoption(
        "--dbgr",
        action="store_true",
        help="Trace tests with dbgr to halt on error.",
    )


def pytest_configure(config):
    if config.option.dbgr:
        config.pluginmanager.register(Trace(), '_dbgr')
        config.pluginmanager.unregister(name='pdb')


class Trace(object):
    def pytest_collection_modifyitems(config, items):
        for item in items:
            item.obj = dbgr.with_trace(item.obj)
