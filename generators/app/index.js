'use strict';

const Generator = require('yeoman-generator');
const fs = require('fs-extra');

const moosicUploadPrompts = [
    {
        type: 'list',
        name: 'uploadType',
        message: 'What kind of upload would you like to perform?',
        choices: [
            'MP3 File',
            'Album',
            'Artist'
        ]
    },
    {
        type: 'input',
        name: 'resourceName',
        message: 'What would you like it to be named?',
        validate(answer) {
            if (/^[a-zA-Z0-9]*$/.test(answer)) {
                return true;
            }
            return 'Name must only contain alphanumeric characters.';
        }
    },
    {
        type: 'input',
        name: 'resourceLocation',
        message: 'Where is this located?',
        validate(answer) {
            if (fs.existsSync(answer)) {
                return true;
            }
            return 'Not found. Enter a valid relative path.'
        }
    }
];

module.exports = class extends Generator {
    promptResourceType() {
        const done = this.async();
        return this.prompt(moosicUploadPrompts).then(answers => {
            let properties = Object.entries(answers);
            this.log(properties);
        });
    }
};
