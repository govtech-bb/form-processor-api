# Command line args

param (
	[Parameter(Mandatory=$true)]
	[string]$FormId
)

# Constants

$schemaLocations = "./schemas" # Start location is where `npm run` is executed
$templateFile = "./scripts/templates/admin_email_template.tmp"
$outputDir = "./src/email/templates/"

# Functions

function ConvertFrom-Field-To-HBS
{
	[CmdletBinding()]
	param(
		[Parameter(Mandatory, ValueFromPipelineByPropertyName)]
		[string] $SectionName,
		[Parameter(Mandatory, ValueFromPipelineByPropertyName)]
		[PsCustomObject]$Field
	)

	process
	{
		$fieldInfo = [PsCustomObject]@{
			name = $Field.name
			type = $Field.type
			label = $Field.label
			required = $Field.required
		}

		$fieldValue = "$SectionName.$($fieldInfo.name)"

		$fieldHbs = @"
			<div class="field">
				<span class="field-label"> $($fieldInfo.label) </span>
				<span class='field-value'> {{$fieldValue}} </span>
			</div>
"@
		
		if (-not $fieldInfo.required)
		{
			$fieldHbs = @"
				{{#if $fieldValue}}
					$fieldHbs
				{{/if}}
"@
		}

		return $fieldHbs
	}
}

function ConvertFrom-Section-To-HBS
{
	[CmdletBinding()]
	param(
		[Parameter(Mandatory, ValueFromPipeline)]
		[pscustomobject]$Section
	)
	
	process
	{
		$fields = foreach ($field in $Section.fields)
		{
			[pscustomobject]@{
				SectionName = $Section.name
				Field = $field
			}
		}

		$HBSFields = $fields | ConvertFrom-Field-To-HBS
		$HBSFieldsText = $HBSFields -join "`n"

		$sectionStr = @"
		<div class='section'>
			<div class='section-title'> $($Section.name) </div>
			$HBSFieldsText
		</div>
"@
		return $sectionStr
	}
}


# Obtain title from FormId

$title = $FormId.Replace("-", " ")
$title = (Get-Culture).TextInfo.ToTitleCase($title)

# Set files

$schemaFile = Join-Path -Path $schemaLocations -ChildPath "$FormId.json"
$outputFile = Join-Path -Path $outputDir -ChildPath "$FormID.hbs"

# Read in the JSON Schema

$schema = Get-Content $schemaFile -Raw | ConvertFrom-Json
$allFields = $schema.fields

# Now we need to go through each record and do parsing.

$sections = $allFields | ConvertFrom-Section-To-HBS

# Write-Output $sections

# Get Template Content and add values

$template = Get-Content $templateFile -Raw

$template = $template.Replace("{! Title !}", $title)
$template = $template.Replace("{! Sections !}", $sections)

Set-Content -Path $outputFile -Value $template

