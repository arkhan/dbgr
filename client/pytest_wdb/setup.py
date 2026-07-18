from setuptools import setup

setup(
    name="pytest_dbgr",
    version='0.4.0',
    author="Florian Mounier @ kozea",
    author_email="florian.mounier@kozea.fr",
    url="https://github.com/arkhan/dbgr",
    license='GPLv3',
    py_modules=['pytest_dbgr'],
    install_requires=['dbgr'],
    description="Trace pytest tests with dbgr to halt on error with --dbgr.",
    entry_points={'pytest11': ['pytest_dbgr = pytest_dbgr']},
)
