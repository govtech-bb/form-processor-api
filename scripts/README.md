# Form-Processor-Api Scripts

This document seeks to outline custom scripts developed to automate certain processes within the `form-processor-api` service.

This folder provides the following structure:

- `templates/`: Directory for any template files used by scripts
- `README.md`: This File
- `*.ps1/*.js`: Script files that accomplish some task.


## Admin Email Template Creation

This script is called `admin_email_create.ps1`, and is used to quickly scaffold admin email templates, given a schema from `../schemas/`.
This is a powershell script, and will require Powershell to be installed, along with being able to run the `pwsh` command.

### Using the Script

In this project, the script is intended to be used by running: 

`npm run template:create-admin-email`

However, the prompt for a form id can be skipped by running:

`npm run template:create-admin-email -- -FormId id-of-form`

For example:

`npm run template:create-admin-email -- -FormId jobstart-plus-programme`

The script can also be run manually from this directory by using `pwsh ./admin_email_create.ps1`, however, no command line configuration is provided to allow for moving to different directories.

> [!NOTE]
> I also have not added error handling to the script. Will have that as a TODO.

### Known Issues

1. Does not yet handle missing files, or any errors resulting from such
1. You will still need to perform manual edits, such as merging First Name, Last Name, and Middle Names into one field, and fixing the casing for `section-title`s.
1. Requires Powershell
