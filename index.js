#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { program } from 'commander';
import recursive from 'recursive-readdir-sync';
import isUrl from 'is-url-superb';
import parseCssUrls from 'css-url-parser';

const packageJson = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url)));

const options = program
    .version(packageJson.version)
    .description('Checks if all images in CSS files exist')
    .option('-f, --folder <folder>', 'Folder with CSS files to check')
    .option('-v, --verbose', 'Add more output')
    .parse(process.argv)
    .opts();

const checkFolder = async () => {
    let errors = 0;
    const files = recursive(options.folder);

    files.forEach((file) => {
        const ext = path.extname(file);
        if (ext !== '.css') return;

        const fileContent = fs.readFileSync(file, { encoding: 'utf-8' });
        const filePath = path.dirname(file) + path.sep;
        const cssUrls = parseCssUrls(fileContent);

        cssUrls.forEach((cssUrl) => {
            if (isUrl(cssUrl)) return;

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
        });
    });

    console.log(`Number of errors: ${errors}`);
    return errors;
};

if (!options.folder) {
    console.log('Oops! Please specify a folder');
    process.exitCode = 2;
} else if (!fs.existsSync(options.folder)) {
    console.log(`Oops! Folder does not exist: ${options.folder}`);
    process.exitCode = 3;
} else if (!fs.statSync(options.folder).isDirectory()) {
    console.log(`Oops! Folder is not a real folder: ${options.folder}`);
    process.exitCode = 4;
} else {
    checkFolder().then((err) => {
        process.exitCode = err > 0 ? 1 : 0;
    });
}
