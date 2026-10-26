@echo off
rem "node" para o electron-builder: usa o Electron de work\electron-runtime como Node.
rem Atenção: argumentos com virgula ou %% quebram neste atalho.
set ELECTRON_RUN_AS_NODE=1
set ELECTRON_NO_ASAR=1
"%~dp0..\..\..\..\electron-runtime\electron.exe" %*
