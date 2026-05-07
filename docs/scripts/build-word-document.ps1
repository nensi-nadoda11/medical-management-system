param(
  [string]$SourcePath = "E:\medical_management_system\docs\medical-management-system-project-documentation.md",
  [string]$OutputPath = "E:\medical_management_system\docs\Medical-Management-System-Project-Documentation.docx"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Escape-XmlText {
  param([string]$Text)

  if ($null -eq $Text) {
    return ""
  }

  $escaped = $Text.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;")
  $escaped = $escaped.Replace('"', "&quot;").Replace("'", "&apos;")
  return $escaped
}

function New-ParagraphXml {
  param(
    [string]$Text,
    [string]$Style = "Normal"
  )

  $safeText = Escape-XmlText $Text
  return @"
<w:p>
  <w:pPr>
    <w:pStyle w:val="$Style" />
  </w:pPr>
  <w:r>
    <w:t xml:space="preserve">$safeText</w:t>
  </w:r>
</w:p>
"@
}

if (-not (Test-Path -LiteralPath $SourcePath)) {
  throw "Source file not found: $SourcePath"
}

$sourceLines = Get-Content -LiteralPath $SourcePath -Encoding UTF8
$paragraphs = New-Object System.Collections.Generic.List[string]

foreach ($line in $sourceLines) {
  $trimmed = $line.Trim()

  if ($trimmed.Length -eq 0) {
    $paragraphs.Add("<w:p />")
    continue
  }

  if ($trimmed.StartsWith("# ")) {
    $paragraphs.Add((New-ParagraphXml -Text $trimmed.Substring(2) -Style "Title"))
    continue
  }

  if ($trimmed.StartsWith("## ")) {
    $paragraphs.Add((New-ParagraphXml -Text $trimmed.Substring(3) -Style "Heading1"))
    continue
  }

  if ($trimmed.StartsWith("### ")) {
    $paragraphs.Add((New-ParagraphXml -Text $trimmed.Substring(4) -Style "Heading2"))
    continue
  }

  $paragraphs.Add((New-ParagraphXml -Text $trimmed -Style "Normal"))
}

$documentBody = ($paragraphs -join "`r`n")

$contentTypesXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="xml" ContentType="application/xml" />
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" />
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml" />
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml" />
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml" />
</Types>
"@

$relsXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml" />
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml" />
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml" />
</Relationships>
"@

$documentXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
  xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
  mc:Ignorable="w14 wp14">
  <w:body>
$documentBody
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840" />
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0" />
      <w:cols w:space="720" />
      <w:docGrid w:linePitch="360" />
    </w:sectPr>
  </w:body>
</w:document>
"@

$stylesXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal" />
    <w:qFormat />
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" />
      <w:sz w:val="22" />
      <w:lang w:val="en-IN" />
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title" />
    <w:basedOn w:val="Normal" />
    <w:qFormat />
    <w:pPr>
      <w:spacing w:after="240" />
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" />
      <w:b />
      <w:sz w:val="34" />
      <w:color w:val="0F172A" />
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="Heading 1" />
    <w:basedOn w:val="Normal" />
    <w:qFormat />
    <w:pPr>
      <w:spacing w:before="240" w:after="120" />
    </w:pPr>
    <w:rPr>
      <w:b />
      <w:sz w:val="28" />
      <w:color w:val="111827" />
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="Heading 2" />
    <w:basedOn w:val="Normal" />
    <w:qFormat />
    <w:pPr>
      <w:spacing w:before="160" w:after="80" />
    </w:pPr>
    <w:rPr>
      <w:b />
      <w:sz w:val="24" />
      <w:color w:val="1F2937" />
    </w:rPr>
  </w:style>
</w:styles>
"@

$escapedDate = Escape-XmlText (Get-Date -Format "yyyy-MM-ddTHH:mm:ssK")
$coreXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:dcmitype="http://purl.org/dc/dcmitype/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Medical Management System Project Documentation</dc:title>
  <dc:creator>OpenAI Codex</dc:creator>
  <cp:lastModifiedBy>OpenAI Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">$escapedDate</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">$escapedDate</dcterms:modified>
</cp:coreProperties>
"@

$appXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
  xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Office Word</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <Company>OpenAI</Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>16.0000</AppVersion>
</Properties>
"@

$documentRelsXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships" />
"@

$buildRoot = Join-Path "E:\medical_management_system\docs" (".docx-build-" + [Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $buildRoot | Out-Null
New-Item -ItemType Directory -Path (Join-Path $buildRoot "_rels") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $buildRoot "docProps") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $buildRoot "word") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $buildRoot "word\_rels") | Out-Null

Set-Content -LiteralPath (Join-Path $buildRoot "[Content_Types].xml") -Value $contentTypesXml -Encoding UTF8
Set-Content -LiteralPath (Join-Path $buildRoot "_rels\.rels") -Value $relsXml -Encoding UTF8
Set-Content -LiteralPath (Join-Path $buildRoot "word\document.xml") -Value $documentXml -Encoding UTF8
Set-Content -LiteralPath (Join-Path $buildRoot "word\styles.xml") -Value $stylesXml -Encoding UTF8
Set-Content -LiteralPath (Join-Path $buildRoot "word\_rels\document.xml.rels") -Value $documentRelsXml -Encoding UTF8
Set-Content -LiteralPath (Join-Path $buildRoot "docProps\core.xml") -Value $coreXml -Encoding UTF8
Set-Content -LiteralPath (Join-Path $buildRoot "docProps\app.xml") -Value $appXml -Encoding UTF8

if (Test-Path -LiteralPath $OutputPath) {
  Remove-Item -LiteralPath $OutputPath -Force
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($buildRoot, $OutputPath)

Remove-Item -LiteralPath $buildRoot -Recurse -Force

Write-Output "Created Word document: $OutputPath"
