# Manual Medicine Master Records

These records match the current medicine master validation in the project.

Important:
- Create the `categories` first.
- Then create the `manufacturers`.
- After that, add the `medicines`.
- In the medicine form, `categoryId` and `manufacturerId` are selected from the dropdown, so below I have given the matching category and manufacturer names for manual entry.

## Categories

```json
[
  {
    "name": "Pain & Fever Relief",
    "description": "General fever, headache, and body pain medicines used in day-to-day pharmacy dispensing.",
    "status": "active"
  },
  {
    "name": "Anti-Infective Care",
    "description": "Antibiotic and anti-infective medicines used for bacterial infection treatment workflows.",
    "status": "active"
  },
  {
    "name": "Gastro & Acid Control",
    "description": "Medicines used for acidity, reflux, gastric irritation, and stomach protection support.",
    "status": "active"
  },
  {
    "name": "Respiratory & Allergy Care",
    "description": "Medicines used for allergy, cold, cough, wheeze, and upper respiratory symptom relief.",
    "status": "active"
  },
  {
    "name": "Diabetes Management",
    "description": "Oral anti-diabetic medicines and related products used for blood sugar management.",
    "status": "active"
  }
]
```

## Manufacturers

```json
[
  {
    "name": "Micro Labs Ltd",
    "status": "active"
  },
  {
    "name": "Cipla Ltd",
    "status": "active"
  },
  {
    "name": "Sun Pharmaceutical Industries Ltd",
    "status": "active"
  },
  {
    "name": "Mankind Pharma Ltd",
    "status": "active"
  },
  {
    "name": "USV Pvt Ltd",
    "status": "active"
  }
]
```

## Medicines

```json
[
  {
    "medicineName": "Dolo 650",
    "genericName": "Paracetamol",
    "brandName": "Dolo 650",
    "strength": "650 mg",
    "form": "tablet",
    "unit": "strip",
    "category": "Pain & Fever Relief",
    "manufacturer": "Micro Labs Ltd",
    "hsnCode": "3004",
    "gstPercent": 12,
    "barcode": "8901234567001",
    "reorderLevel": 20,
    "prescriptionRequired": false,
    "notes": "Common fever and pain relief medicine for routine pharmacy billing and stock testing.",
    "status": "active"
  },
  {
    "medicineName": "Azicip 500",
    "genericName": "Azithromycin",
    "brandName": "Azicip",
    "strength": "500 mg",
    "form": "tablet",
    "unit": "strip",
    "category": "Anti-Infective Care",
    "manufacturer": "Cipla Ltd",
    "hsnCode": "3004",
    "gstPercent": 12,
    "barcode": "8901234567002",
    "reorderLevel": 10,
    "prescriptionRequired": true,
    "notes": "Use this as an antibiotic sample record for purchase, stock, and alert testing.",
    "status": "active"
  },
  {
    "medicineName": "Pantocid 40",
    "genericName": "Pantoprazole",
    "brandName": "Pantocid",
    "strength": "40 mg",
    "form": "tablet",
    "unit": "strip",
    "category": "Gastro & Acid Control",
    "manufacturer": "Sun Pharmaceutical Industries Ltd",
    "hsnCode": "3004",
    "gstPercent": 12,
    "barcode": "8901234567003",
    "reorderLevel": 15,
    "prescriptionRequired": true,
    "notes": "Suitable for acidity and gastro sample testing across purchase and inventory flows.",
    "status": "active"
  },
  {
    "medicineName": "Montair LC",
    "genericName": "Montelukast + Levocetirizine",
    "brandName": "Montair LC",
    "strength": "10 mg + 5 mg",
    "form": "tablet",
    "unit": "strip",
    "category": "Respiratory & Allergy Care",
    "manufacturer": "Mankind Pharma Ltd",
    "hsnCode": "3004",
    "gstPercent": 12,
    "barcode": "8901234567004",
    "reorderLevel": 12,
    "prescriptionRequired": true,
    "notes": "Useful for allergy and seasonal respiratory medicine testing scenarios.",
    "status": "active"
  },
  {
    "medicineName": "Glycomet 500 SR",
    "genericName": "Metformin",
    "brandName": "Glycomet 500 SR",
    "strength": "500 mg",
    "form": "tablet",
    "unit": "strip",
    "category": "Diabetes Management",
    "manufacturer": "USV Pvt Ltd",
    "hsnCode": "3004",
    "gstPercent": 12,
    "barcode": "8901234567005",
    "reorderLevel": 18,
    "prescriptionRequired": true,
    "notes": "Good sample for chronic therapy medicine testing in stock and reorder workflows.",
    "status": "active"
  }
]
```

## Field Checklist For Manual Entry

Medicine form fields in this project:
- `medicineName`
- `genericName`
- `brandName`
- `strength`
- `form`
- `unit`
- `category`
- `manufacturer`
- `hsnCode`
- `gstPercent`
- `barcode`
- `reorderLevel`
- `prescriptionRequired`
- `notes`
- `status`

Category form fields:
- `name`
- `description`
- `status`

Manufacturer form fields:
- `name`
- `status`
