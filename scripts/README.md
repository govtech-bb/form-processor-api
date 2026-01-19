# Form-Processor-Api Scripts

This document seeks to outline custom scripts developed to automate certain processes within the `form-processor-api` service.

This folder provides the following structure:

- `templates/`: Directory for any template files used by scripts
- `README.md`: This File
- `*.ps1/*.js`: Script files that accomplish some task.


## Admin Email Template Creation

This script is called `admin_email_create.ps1`, and is used to quickly scaffold admin email templates, given a schema from `../schemas/`.

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
