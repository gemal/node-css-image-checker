#!/usr/bin/env node

'use strict';

import fs from 'fs';
import path from 'path';
import { program } from 'commander';
import recursive from 'recursive-readdir-sync';
import isUrl from 'is-url-superb';
import parseCssUrls from 'css-url-parser';

// Load package.json data
const packageJson = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url)));

async function checkFolder() {
    let errors = 0;
    const files = recursive(options.folder);

    files.forEach(function(file) {
        const ext = path.extname(file);
        if (ext === '.css') {
            const filePath = path.dirname(file) + path.sep;
            const filecontent = fs.readFileSync(file, { encoding: 'utf-8' });
            const cssUrls = parseCssUrls(filecontent);
            cssUrls.forEach(function(cssUrl) {
                if (!isUrl(cssUrl)) {
                    const cssReal = cssUrl.replace(/(\?|#).*$/, '');
                    let fullPath = filePath + cssReal;
                    if (cssReal.charAt(0) === '/') {
                        fullPath = options.folder + cssReal;
                    }
                    if (!fs.existsSync(fullPath)) {
                        console.log('Error found in: ' + file);
                        console.log('Full path not found: ' + fullPath);
                        console.log('Path in CSS file: ' + cssUrl);
                        if (cssUrl !== cssReal) {
                            console.log('Original path in CSS file: ' + cssReal);
                        }
                        console.log();
                        errors++;
                    } else {
                        if (options.verbose) {
                            console.log('OK: ' + fullPath);
                        }
                    }
                }
            });
        }
    });
    console.log('Number of errors: ' + errors);
    return errors;
}

program
    .version(packageJson.version) // Use loaded JSON version
    .description('Checks if all images in CSS files exist')
    .option('-f, --folder <folder>', 'Folder with CSS files to check')
    .option('-v, --verbose', 'Add more output')
    .parse(process.argv);

const options = program.opts();
if (options.folder) {
    if (fs.existsSync(options.folder)) {
        const stats = fs.statSync(options.folder);
        if (stats.isDirectory()) {
            checkFolder().then((err) => {
                process.exitCode = err > 0 ? 1 : 0;
            });
        } else {
            console.log('Oops! Folder is not a real folder: ' + options.folder);
            process.exitCode = 4;
        }
    } else {
        console.log('Oops! Folder does not exist: ' + options.folder);
        process.exitCode = 3;
    }
} else {
    console.log('Oops! Please specify a folder');
    process.exitCode = 2;
}
