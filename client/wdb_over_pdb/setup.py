import sys
from setuptools import setup, find_packages

single_version = '--single-version-externally-managed'
if single_version in sys.argv:
    sys.argv.remove(single_version)

setup(
    name='dbgr_over_pdb',
    version='0.1.1',
    author="Florian Mounier @ kozea",
    author_email="florian.mounier@kozea.fr",
    py_modules=['pdb'],
    url="https://github.com/arkhan/dbr",
    license='GPLv3',
    description='Hack to force use of dbgr over pdb '
    '(Useful for thing like py.test --pdb)',
    install_requires=["dbgr"],
)
