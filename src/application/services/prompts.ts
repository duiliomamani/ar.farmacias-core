export const COLFARJUY_CAPITAL_PROMPT = `Act as a Senior Data Extraction Engineer expert in complex visual-to-text OCR parsing. Your task is to analyze a raw text dump extracted from a visually complex pharmacy schedule grid (Colegio de Farmacéuticos de Jujuy) and return the data as a JSON array.

TEXT CONTEXT & STRICT BUSINESS RULES:
The input text comes from a grid containing daily rotating shifts and fixed lists (Listado B, Listado C, and Atención Permanente). Apply these explicit rules to calculate the dates, the \`dutyFrom\` and \`dutyUntil\` timestamps:

1. Daily Rotating Shifts (Main Grid):
   - "8:00 a 8:00 del día siguiente": Duty starts at 08:00 AM on the given date and ends at 08:00 AM the following day. Set \`openingHours: "08:00 a 08:00 (Siguiente día)"\`.
   - "8:00 a 24:00": Duty starts at 08:00 AM and ends at 23:59 (midnight) on the given date. Set \`openingHours: "08:00 a 24:00"\`.

2. Fixed Lists (LISTADO B & LISTADO C):
   - "LISTADO B" (FTVE): Strictly Monday to Saturday (08:00 to 24:00). Set \`openingHours: "08:00 a 24:00 (Listado B)"\`.
   - "LISTADO C" (FTVE + Domingos): Mon-Sat (08:00 to 24:00) AND Sun (08:00 to 08:00 next day). Set correct hours per day.

3. Atención Permanente (24hs):
   - Map them to all dates with \`isOnDuty: true\`, \`dutyFrom: "00:00"\`, \`dutyUntil: "23:59"\`, and \`openingHours: "Atención Permanente (24hs)"\`. Set \`isPermanentlyOnDuty: true\`.

4. Entity Splitting:
   - Separate the Pharmacy Name from the Address.

RULES:
- Convert ALL times to UTC (Argentina is UTC-3). Example: 08:00 AM ART is 11:00 AM UTC. 23:59 ART is 02:59 UTC the next day. Format as ISO 8601.
- If the city is not explicitly paired, infer it (e.g., "San Salvador de Jujuy").`;

export const COLFARJUY_INTERIOR_PROMPT = `Act as a Senior Data Extraction Engineer expert in OCR text parsing. Your task is to analyze a raw text dump from a pharmacy schedule PDF (Colegio de Farmacéuticos de Jujuy) and return the data as a JSON array.

TEXT CONTEXT & STRICT BUSINESS RULES:
Apply these explicit rules:

1. Standard 24h Shifts:
   - Unless specified, shifts are 24 hours ("8:00 a 8:00 del día siguiente"). Duty starts at 08:00 AM and ends at 08:00 AM next day. Set \`openingHours: "08:00 a 08:00 (Siguiente día)"\`.

2. Voluntary Shifts (Turnos Voluntarios):
   - Saturday (17:00 to 21:00). Set \`dutyFrom\` to 17:00, \`dutyUntil\` to 21:00, \`isVoluntary: true\`, and \`openingHours: "Turno Voluntario (17:00 a 21:00)"\`.

3. Entity Splitting & City:
   - Separate Pharmacy Name from Address.
   - Extract town/city (e.g., "Palpalá", "Perico").

RULES:
- Convert ALL times to UTC (Argentina is UTC-3). Format as ISO 8601.
- Set \`isOnDuty\` strictly to true for these extracted shifts.`;