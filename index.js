#!/usr/bin/env node

import fs from 'fs';
import isUrl from 'is-url-superb';
import parseCssUrls from 'css-url-parser';
import path from 'path';
import { program } from 'commander';
import recursive from 'recursive-readdir-sync';

// Load package.json data
const packageJson = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url))),

/**
 * Check a folder for missing images in CSS files.
 * @param {object} options - Command line options.
 * @returns {Promise<number>} The number of errors found.
 */
checkFolder = async (options) => {
    await Promise.resolve();

    let errors = 0;
    const files = recursive(options.folder);

    files.forEach((file) => {
        const ext = path.extname(file);
        if (ext === '.css') {
            const fileContent = fs.readFileSync(file, { encoding: 'utf-8' }),
             filePath = path.dirname(file) + path.sep,
             cssUrls = parseCssUrls(fileContent);
            cssUrls.forEach((cssUrl) => {
                if (!isUrl(cssUrl)) {
                    const cssReal = cssUrl.replace(/(\?|#).*$/, '');
                    let fullPath = filePath + cssReal;
                    if (cssReal.startsWith('/')) {
                        fullPath = options.folder + cssReal;
                    }
                    if (!fs.existsSync(fullPath)) {
                        console.log(`Error found in: ${file}`);
                        console.log(`Full path not found: ${fullPath}`);
                        console.log(`Path in CSS file: ${cssUrl}`);
                        if (cssUrl !== cssReal) {
                            console.log(`Original path in CSS file: ${cssReal}`);
                        }
                        console.log();
                        errors++;
                    } else if (options.verbose) {
                        console.log(`OK: ${fullPath}`);
                    }
                }
            });
        }
    });

    console.log(`Number of errors: ${errors}`);
    return errors;
},

 options = program
    .version(packageJson.version)
    .description('Checks if all images in CSS files exist')
    .option('-f, --folder <folder>', 'Folder with CSS files to check')
    .option('-v, --verbose', 'Add more output')
    .parse(process.argv)
    .opts();

if (options.folder) {
    if (fs.existsSync(options.folder)) {
        const stats = fs.statSync(options.folder);
        if (stats.isDirectory()) {
            checkFolder(options).then((err) => {
                if (err > 0) {
                    process.exitCode = 1;
                } else {
                    process.exitCode = 0;
                }
            });
        } else {
            console.log(`Oops! Folder is not a real folder: ${options.folder}`);
            process.exitCode = 4;
        }
    } else {
        console.log(`Oops! Folder does not exist: ${options.folder}`);
        process.exitCode = 3;
    }
} else {
    console.log('Oops! Please specify a folder');
    process.exitCode = 2;
}
