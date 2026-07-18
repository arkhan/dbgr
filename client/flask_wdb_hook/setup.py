import os
import sys
from distutils.sysconfig import get_python_lib

from setuptools import setup

site_packages_path = get_python_lib().replace(sys.prefix + os.path.sep, '')

setup(
    name="flask-dbgr-hook",
    version='0.2.1',
    author="Florian Mounier @ kozea",
    author_email="florian.mounier@kozea.fr",
    url="https://github.com/arkhan/dbr",
    license='GPLv3',
    packages=[],
    install_requires=['dbgr >= 3.3.0'],
    data_files=[(site_packages_path, ['flask-dbgr.pth'])],
    description="Hook to replace flask werkzeug debugger with dbgr.",
)
