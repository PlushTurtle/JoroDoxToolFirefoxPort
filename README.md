# JoroDox for Firefox

JoroDox is a tool for assisting in creating mods for Paradox Development Studio games such as Europa Universalis IV and Crusader Kings II.

This repository contains a Firefox-compatible port of the original JoroDox project created by Daan Broekhof (Joror).

## About

The original JoroDox project was released as an open-source modding tool for Paradox games and is available at:

https://github.com/DaanBroekhof/JoroDox

https://forum.paradoxplaza.com/forum/threads/tool-jorodox-mod-making-tool.831597/

This fork modernises the project for Firefox WebExtensions while preserving the original functionality and workflow where possible.

## Features

- Mod directory browsing
- ZIP export
- Localisation and data-file viewing
- PDX asset inspection
- Mesh viewing and editing
- Animation assignment
- PDXMesh ⇄ Collada conversion
- Image preview support
- Firefox WebExtension compatibility

## Firefox Port Status

Tested on Firefox 160.0.1.

Verified features include:

- Project import
- Text and localisation file viewing
- Save and reopen workflows
- ZIP export
- Mesh editing
- Animation assignment
- Mesh-to-Collada conversion

Known inherited limitations:

- Arbitrary file creation is not supported
- Arbitrary file duplication is not supported
- Direct editing of .yml/.txt files through the file browser is not supported
- Province map analysis appears inconsistent in being functional in both the original Chrome version and this Firefox port

## Development Notes

AI-assisted tools were used during development of the Firefox port. All changes were manually reviewed and tested against the original JoroDox behaviour where possible.

Validation included import, export, save/reopen workflows, large real-world mod testing, mesh tools, file viewing, and Firefox-specific compatibility testing.

## License

This project remains licensed under the MIT License.

Original JoroDox copyright:

Copyright (c) 2015 Daan Broekhof
