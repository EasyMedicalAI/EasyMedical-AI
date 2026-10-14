// Plain-language explanations for common lab tests. Each paragraph is based on the MedlinePlus
// page linked with it (MedlinePlus is published by the U.S. National Library of Medicine).
// Entries avoid specific numbers. Numbers come from the reference ranges in labReferenceRanges.ts. Tests without a matching entry show no explanation.

export interface LabExplanation {
  text: string;
  sourceName: string;
  sourceUrl: string;
}

const MEDLINEPLUS = 'MedlinePlus (National Library of Medicine)';
// Each test links to the MedlinePlus lab tests index, where its full page is listed.
const LAB_INDEX = 'https://medlineplus.gov/lab-tests/';

const EXPLANATIONS: { match: RegExp; explanation: LabExplanation }[] = [
  {
    match: /a1c|hba1c|glycated hemoglobin|glycohemoglobin/i,
    explanation: {
      text:
        'A1C shows your average blood sugar over the past two to three months, because it measures what share of your red blood cells have sugar attached to their hemoglobin. Below 5.7% is normal, 5.7% to 6.4% falls in the prediabetes range, and 6.5% or higher falls in the diabetes range. Medicines, pregnancy, anemia, kidney failure, and liver disease can change the result, so ask your provider what your number means for you.',
      sourceName: MEDLINEPLUS,
      sourceUrl: 'https://medlineplus.gov/lab-tests/hemoglobin-a1c-hba1c-test/',
    },
  },
  {
    match: /^(fasting )?glucose$/i,
    explanation: {
      text:
        'Glucose is the sugar in your blood, your body’s main source of energy. A higher reading can point to prediabetes or diabetes, but it can also come from thyroid, pancreas, or adrenal problems, from stress after surgery or serious illness, or from some medicines. A lower reading can come from diabetes medicines, not eating enough, or heavy physical activity, and is uncommon in people without diabetes.',
      sourceName: MEDLINEPLUS,
      sourceUrl: 'https://medlineplus.gov/lab-tests/blood-glucose-test/',
    },
  },
  {
    match: /^ldl/i,
    explanation: {
      text:
        'LDL is often called "bad" cholesterol because it carries cholesterol and is the main source of blockages in the arteries. For adults 20 and older, a healthy level is less than 100 mg/dL, and lower is better.',
      sourceName: MEDLINEPLUS,
      sourceUrl: 'https://medlineplus.gov/lab-tests/cholesterol-levels/',
    },
  },
  {
    match: /^hdl/i,
    explanation: {
      text:
        'HDL is often called "good" cholesterol because it helps remove LDL from the blood, and higher levels may lower the risk of heart attack and stroke. For adults 20 and older, 60 mg/dL or more is best. Below 40 mg/dL in men and below 50 mg/dL in women is considered low.',
      sourceName: MEDLINEPLUS,
      sourceUrl: 'https://medlineplus.gov/lab-tests/cholesterol-levels/',
    },
  },
  {
    match: /^(total )?cholesterol$/i,
    explanation: {
      text:
        'Total cholesterol is the overall amount of cholesterol in your blood, including both HDL and LDL. For adults 20 and older, a healthy level is less than 200 mg/dL. Your age, family history, and other risk factors all affect what target is right for you.',
      sourceName: MEDLINEPLUS,
      sourceUrl: 'https://medlineplus.gov/lab-tests/cholesterol-levels/',
    },
  },
  {
    match: /triglyceride/i,
    explanation: {
      text:
        'Triglycerides are a type of fat in the blood. High levels may raise the risk of heart disease, especially in women. The page does not list a numeric target, so ask your provider what your level means for you.',
      sourceName: MEDLINEPLUS,
      sourceUrl: 'https://medlineplus.gov/lab-tests/cholesterol-levels/',
    },
  },
  {
    match: /^creatinine/i,
    explanation: {
      text:
        'Creatinine is a waste product your muscles make as they work. Healthy kidneys filter it out of your blood, so it is a rough signal of how well they are working. A high result can point to kidney disease or injury, but it can also come from dehydration, muscle injury, intense exercise, or a high-meat diet. Low results are uncommon and can come from poor nutrition, reduced muscle mass, or serious liver disease.',
      sourceName: MEDLINEPLUS,
      sourceUrl: 'https://medlineplus.gov/lab-tests/creatinine-test/',
    },
  },
  {
    match: /microalbumin|albumin.*creatinine|albumin.*urine|urine.*albumin/i,
    explanation: {
      text:
        'This urine test checks how much albumin, a common blood protein, is passing into your urine, compared with creatinine. Healthy kidneys let only a trace through, so higher amounts can be an early sign of kidney disease. A single abnormal result does not confirm kidney disease, because exercise, some medicines, fever, and inflammation can raise it temporarily. Providers usually repeat the test over three to six months before drawing conclusions.',
      sourceName: MEDLINEPLUS,
      sourceUrl: 'https://medlineplus.gov/lab-tests/microalbumin-creatinine-ratio/',
    },
  },
  {
    match: /^(wbc|white blood cells?|leukocytes?)( count)?$/i,
    explanation: {
      text:
        'White blood cells fight infection and inflammation. A higher count can come from infection, inflammation, stress, or some medicines. A lower count can make infections more likely. Your provider reads this number together with the other blood counts.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /^(rbc|red blood cells?)( count)?$/i,
    explanation: {
      text:
        'Red blood cells carry oxygen from the lungs to the rest of the body. A low count can point to anemia, which can cause tiredness and shortness of breath. A high count can come from dehydration, smoking, or conditions that increase red cell production.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /^(hemoglobin|hgb)$/i,
    explanation: {
      text:
        'Hemoglobin is the protein in red blood cells that carries oxygen. Low hemoglobin is a sign of anemia, which can cause tiredness and shortness of breath. High levels can come from dehydration or lung conditions.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /^(hematocrit|hct)$/i,
    explanation: {
      text:
        'Hematocrit is the share of your blood made up of red blood cells. It tracks closely with hemoglobin, so low values can point to anemia and high values can point to dehydration or other conditions.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /^(platelets?|plt|platelet count)$/i,
    explanation: {
      text:
        'Platelets are small cell fragments that help blood clot and stop bleeding. A low count can raise the risk of bleeding. A high count can occur with inflammation, iron deficiency, or certain blood disorders.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /^mcv$/i,
    explanation: {
      text:
        'MCV measures the average size of your red blood cells. Small cells can point to iron deficiency. Large cells can point to a shortage of vitamin B12 or folate, heavy alcohol use, or certain medicines.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /^mch$/i,
    explanation: {
      text:
        'MCH is the average amount of hemoglobin in each red blood cell. It usually moves with MCV, so the pattern of the results helps your provider find the cause of anemia.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /^mchc$/i,
    explanation: {
      text:
        'MCHC is the average concentration of hemoglobin inside red blood cells. Low values often go along with iron deficiency.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /^rdw/i,
    explanation: {
      text:
        'RDW measures how much red blood cells vary in size. A high value can appear early in iron or vitamin deficiencies, often before other counts change.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /neutrophil|^neut\b|^anc\b/i,
    explanation: {
      text:
        'Neutrophils are the most common white blood cells and the first to respond to bacterial infection. A high count often means infection or inflammation. A low count can raise the risk of infection.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /lymphocyte|^lymph\b/i,
    explanation: {
      text:
        'Lymphocytes are white blood cells that fight viruses and help coordinate the immune system. A high count is often seen with viral infections. A low count can occur with some infections, medicines, or immune conditions.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /monocyte|^mono\b/i,
    explanation: {
      text:
        'Monocytes are white blood cells that clean up damaged cells and help fight infection. Higher counts can occur during some infections and in long-term inflammation.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /eosinophil|^eos\b/i,
    explanation: {
      text:
        'Eosinophils are white blood cells involved in allergic reactions and in fighting parasites. A high count is often linked to allergies, asthma, or some medicines.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /basophil|^baso\b/i,
    explanation: {
      text:
        'Basophils are the least common white blood cells and take part in allergic and inflammatory responses. They make up a very small share of the count, so a small change is usually judged together with the other results.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /^(sodium|na)$/i,
    explanation: {
      text:
        'Sodium is a mineral that helps control fluid balance and nerve and muscle function. Low levels can come from fluid loss, some medicines, or heart, kidney, or liver problems. High levels often reflect dehydration.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /^(potassium|k)$/i,
    explanation: {
      text:
        'Potassium is a mineral that helps your heart and muscles work. Both high and low levels can affect the heart rhythm, so this result matters. Kidney problems and some medicines can change it.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /^(chloride|cl)$/i,
    explanation: {
      text:
        'Chloride is an electrolyte that works with sodium to keep fluid and acid-base balance steady. Changes often go along with changes in sodium, vomiting, diarrhea, or kidney problems.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /^(co2|carbon dioxide|bicarbonate|bicarb|total co2)$/i,
    explanation: {
      text:
        'Bicarbonate, measured as carbon dioxide, helps keep the acid-base balance of your blood steady. Low levels can occur with kidney disease, diarrhea, or diabetes that is out of control. High levels can occur with vomiting, some lung problems, or some medicines.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /^calcium/i,
    explanation: {
      text:
        'Calcium is needed for bones, nerves, muscles, and blood clotting. Levels are tightly controlled. High or low results can come from parathyroid or kidney problems, changes in vitamin D, or some medicines.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /^(bun|blood urea nitrogen|urea)/i,
    explanation: {
      text:
        'Blood urea nitrogen (BUN) measures a waste product from protein breakdown that the kidneys filter out. High levels can point to kidney problems or dehydration, and can also follow a high-protein diet. Low levels are usually less concerning.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /egfr|glomerular filtration/i,
    explanation: {
      text:
        'eGFR estimates how well your kidneys filter blood, based on creatinine, age, and sex. Lower numbers mean less filtering. A value that stays low over time can point to chronic kidney disease.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /^(alt|alanine)/i,
    explanation: {
      text:
        'ALT is an enzyme found mainly in the liver. A higher level can mean the liver is inflamed or injured, which can come from fatty liver, alcohol, some medicines, or hepatitis. A single mild change is common and is often rechecked.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /^(ast|aspartate)/i,
    explanation: {
      text:
        'AST is an enzyme found in the liver, heart, and muscles. It rises with liver injury and with muscle damage, so your provider compares it with ALT to narrow down the cause.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /alkaline phosphatase|^alp$/i,
    explanation: {
      text:
        'Alkaline phosphatase is an enzyme found in the liver, the bile ducts, and bone. High levels can point to bile duct problems or liver disease, or to bone growth or bone disease.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /bilirubin/i,
    explanation: {
      text:
        'Bilirubin is a yellow substance made when old red blood cells break down. The liver clears it. High levels can cause yellowing of the skin or eyes and can point to liver, bile duct, or blood problems.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /^albumin$/i,
    explanation: {
      text:
        'Albumin is the most common protein in the blood. It helps keep fluid inside the blood vessels and carries many substances. Low levels can come from liver or kidney disease, poor nutrition, or inflammation.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /total protein/i,
    explanation: {
      text:
        'Total protein measures albumin and globulins, the proteins in your blood. Changes can reflect liver disease, kidney problems, infection, or nutrition.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /free t4|^t4\b|thyroxine/i,
    explanation: {
      text:
        'Free T4 is the active thyroid hormone that is not bound to protein. Together with TSH it shows how your thyroid is working. High levels can point to an overactive thyroid, and low levels can point to an underactive thyroid.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /ferritin/i,
    explanation: {
      text:
        'Ferritin reflects how much iron your body has stored. Low levels usually mean low iron stores. High levels can reflect inflammation, liver problems, or too much iron.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /^iron$/i,
    explanation: {
      text:
        'Iron is measured in the blood to see how much is circulating. It changes through the day, so it is usually read together with ferritin and other iron tests. Low levels can point to iron deficiency anemia.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /vitamin d|25-?hydroxy/i,
    explanation: {
      text:
        'Vitamin D helps your body absorb calcium and keep bones strong. Low levels are common and can weaken bones over time. Very high levels are rare and can raise blood calcium.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /b12|cobalamin/i,
    explanation: {
      text:
        'Vitamin B12 is needed for healthy nerves and for making red blood cells. Low levels can cause anemia and nerve symptoms. They are more common with some medicines, certain diets, and digestive conditions.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /^psa\b|prostate specific/i,
    explanation: {
      text:
        'PSA is a protein made by the prostate. Higher levels can come from prostate conditions, including cancer, but also from an enlarged prostate, infection, or recent activity. A high reading usually leads to a repeat test or a follow-up conversation with your provider.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /^inr$|prothrombin|^pt$/i,
    explanation: {
      text:
        'INR and prothrombin time measure how long your blood takes to clot. They are used to check blood-thinning medicines such as warfarin. If the result is too high, the risk of bleeding goes up.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
  {
    match: /^tsh\b|thyroid stimulating/i,
    explanation: {
      text:
        'TSH is the signal the brain sends to the thyroid to make its hormones. High TSH often means the thyroid is underactive, and low TSH often means it is overactive. Your provider reads TSH together with free T4.',
      sourceName: MEDLINEPLUS,
      sourceUrl: LAB_INDEX,
    },
  },
];

export function explanationFor(testName: string): LabExplanation | undefined {
  const name = testName.trim();
  return EXPLANATIONS.find((entry) => entry.match.test(name))?.explanation;
}
