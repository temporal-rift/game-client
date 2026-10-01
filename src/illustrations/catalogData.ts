import type { CardType, Faction, SpecialAction } from '../api/action'

export const ILLUSTRATION_SKINS = ['board', 'engraving'] as const
export type IllustrationSkin = (typeof ILLUSTRATION_SKINS)[number]

export const EVENT_CATALOG = [
  ['12606191-eafe-4d1c-a014-b676bf094db0', 'delegate'], ['ab0d99ea-6f75-4d8d-b1a7-7a1a063635a4', 'pact'],
  ['400e3361-301f-4ec1-9edd-cb0c6e14fbc6', 'reactor'], ['deafa163-28f7-4563-85af-a91dbf324360', 'archive'],
  ['6b17534a-f7fa-4169-9e6a-bb4a47a51e1d', 'general'], ['cadd24bc-9e2b-477e-a9fa-46bc34d5b218', 'plague-ship'],
  ['002809a2-26ca-4bf8-bbe9-15f4410ab963', 'radio'], ['a0775498-2b18-43bd-bbc0-1a9477b8c378', 'chancellor'],
  ['31515461-7ebb-4560-beff-78e091287acb', 'ruins'], ['ef09c944-721c-42d1-b30f-e261b9e48547', 'ceasefire'],
  ['ba29e0b0-443d-401a-8d60-fcc2e9b9bfdd', 'volcano'], ['b642507f-a0a1-4e8c-a8c6-7d3e91f794ba', 'heir'],
  ['f1a98cff-92eb-4e02-9e03-aa8d745567b5', 'blueprints'], ['6792194d-3de5-45c1-8689-bea5b3ed609d', 'parliament'],
  ['6b7b54b1-7686-4c9d-a738-b1096a5b9f32', 'bridge'], ['a34e8dd7-85d2-45bd-99c1-dccabc2a856e', 'oracle'],
  ['9b7911a9-a976-4840-8dbd-69bf94e1d1d3', 'soldier'], ['fefb7c8c-b455-42f8-944b-0b4f5bc82d6b', 'frontier'],
  ['071e77a8-13f1-4b69-94b6-c505de755ff3', 'trial'], ['641db543-f364-4d62-8a33-54fdafea4345', 'gate'],
  ['a7e1660a-d758-4b56-afe3-004b3ff39023', 'fleet'], ['4e2cfe30-4ca6-4dce-9293-1aab2014ddac', 'burning-archive'],
  ['7e27e136-9959-49ac-90b5-9564decf9f1b', 'resistance'], ['e2fbac19-eca9-49a7-95dd-07fd93be7655', 'null-bomb'],
  ['4dd81d1e-5c35-4dcf-a7e2-1a97739db3f3', 'coronation'], ['d0f70b4d-4efe-47f2-8d15-594cfdabf4da', 'quarantine'],
  ['612f7eae-dc03-47b3-b00b-a04d8198dba2', 'timeline'], ['7b3aaec0-9c59-4105-a0d4-40b3faa72771', 'double-agent'],
  ['a3861263-3faf-45c2-88ec-87834fbdedb2', 'probe'], ['deeda4b1-7b7f-47b4-88db-60e380c7ac02', 'convergence'],
] as const

export const EVENT_ART_KEYS = EVENT_CATALOG.map(([id]) => id)
export const EVENT_FORM_INDEX: Readonly<Record<string, number>> = {
  delegate: 0, pact: 1, reactor: 2, archive: 3, general: 4, 'plague-ship': 5, radio: 6, chancellor: 7, ruins: 8, ceasefire: 9,
  volcano: 10, heir: 11, blueprints: 12, parliament: 13, bridge: 14, oracle: 15, soldier: 16, frontier: 17, trial: 18, gate: 19,
  fleet: 20, 'burning-archive': 21, resistance: 22, 'null-bomb': 23, coronation: 24, quarantine: 25, timeline: 26,
  'double-agent': 27, probe: 28, convergence: 29,
}

export const CARD_ART_KEYS: Readonly<Record<CardType, string>> = {
  PUSH: 'rising-sun', SUPPRESS: 'falling-star', SWING: 'scales', AMPLIFY: 'resonance', INTERCEPT: 'signal-catch',
  SCAN: 'lens', TRACE: 'footprints', DECOY: 'mask', JAM: 'signal-break', STALL: 'hourglass', REDIRECT: 'crossroads',
  NULLIFY: 'crossed-lines', COLLIDE: 'convergence', STABILIZE: 'anchor', DETONATE: 'fracture',
}
export const CARD_FORM_INDEX: Readonly<Record<string, number>> = {
  'rising-sun': 0, 'falling-star': 1, scales: 2, resonance: 3, 'signal-catch': 4, lens: 5, footprints: 6, mask: 7,
  'signal-break': 8, hourglass: 9, crossroads: 10, 'crossed-lines': 11, convergence: 12, anchor: 13, fracture: 14,
}

export const SPECIAL_ART_KEYS: Readonly<Record<SpecialAction, string>> = {
  ANNIHILATE: 'eclipse', CORRUPT: 'inverted-eye', CASCADE: 'falling-stones', FORESIGHT: 'star-map', SEAL: 'wax-seal',
  FULFILLMENT: 'laurel', REWRITE: 'palimpsest', MIMIC: 'twin-masks', OBSCURE: 'veiled-moon', THREAD: 'needle',
  TAPESTRY: 'woven-rift', REWEAVE: 'spindle', RALLY: 'raised-banner', EXPOSE: 'opened-curtain', MOMENTUM: 'wind-rose',
}
export const SPECIAL_FORM_INDEX: Readonly<Record<string, number>> = {
  eclipse: 0, 'inverted-eye': 1, 'falling-stones': 2, 'star-map': 3, 'wax-seal': 4, laurel: 5, palimpsest: 6, 'twin-masks': 7,
  'veiled-moon': 8, needle: 9, 'woven-rift': 10, spindle: 11, 'raised-banner': 12, 'opened-curtain': 13, 'wind-rose': 14,
}

export const FACTION_ART_KEYS: Readonly<Record<Faction, string>> = {
  ERASERS: 'broken-hourglass', PROPHETS: 'watchful-star', REVISIONISTS: 'rewritten-page', WEAVERS: 'interlaced-rings', ACTIVISTS: 'rising-banner',
}
export const FACTION_FORM_INDEX: Readonly<Record<string, number>> = {
  'broken-hourglass': 0, 'watchful-star': 1, 'rewritten-page': 2, 'interlaced-rings': 3, 'rising-banner': 4,
}

export const BOARD = { paper: '#17283b', ink: '#7fc4bd', accent: '#d8bd87', detail: '#d59a87', faint: '#405468' }
export const ENGRAVING = { paper: '#eee5d2', ink: '#624d3b', accent: '#624d3b', detail: '#624d3b', faint: '#624d3b' }

export const EVENT_FORMS = [
  'M170 126V76m0 0 30-25m-30 25-29-19m29 47-23-18m23 18 24-24', 'M125 112l45-65 45 65h-28l-17-25-17 25z',
  'M170 45v82m-30-65h60m-54 19h48m-40 19h32', 'M143 54h54v69h-54zM153 69h34m-34 13h34m-34 13h28m-28 13h19',
  'M141 121V67l29-19 29 19v54m-40-1V87h22v33', 'M118 96q26-35 52 0t52 0m-90 18h77',
  'M170 121V67m-18 10 18-22 18 22m-45 43q27-16 54 0m-46-42h38', 'M140 121V68l30-17 30 17v53m-41-47 11 10 11-10m-22 39h22',
  'M130 117l40-62 40 62zm40-62v62m-22-34h44', 'M130 116q40-61 80 0m-62-20 17 19 17-19m-51 28h68',
  'M170 43l12 32 34 2-26 21 9 33-29-19-29 19 9-33-26-21 34-2z', 'M141 54h58v68h-58zm29 0v68m-29-34h58',
  'M132 119l38-67 38 67m-57-31h38m-49 31h60', 'M132 58h76v64h-76zm13 18h50m-50 14h50m-50 14h29',
  'M126 119l22-40 22 15 22-33 22 58zm22-40V60m44 59v-27', 'M145 118l25-62 25 62m-37-28h24m-42 28h56',
  'M142 121V65l28-18 28 18v56m-43-32h30m-30 14h30', 'M119 106h102m-84-17 33-36 33 36m-66 17 33 17 33-17',
  'M140 55h60v68h-60zm13 15h34m-34 13h34m-34 13h34m-34 13h21', 'M125 119l45-70 45 70m-63-31h36m-27 31 9-22 9 22',
  'M135 116V65l35-20 35 20v51m-53-29 18-18 18 18m-36 16h36', 'M135 121l35-67 35 67m-55-23h40m-30 23v-23m20 23v-23',
  'M170 48v74m-25-57 50 37m-50 0 50-37m-25 57-20-24h40z', 'M129 117q41-68 82 0m-64-19 18 18 18-18m-54 27h72',
  'M145 58h50v64h-50zm25 0v64m-25-32h50m-38-18 26 36', 'M170 43l38 22v44l-38 22-38-22V65zm0 22v43m-21-31 42 20',
  'M132 119l38-69 38 69m-54-35h32m-44 35h56m-28-69v34', 'M135 120l35-68 35 68m-51-28 16 18 16-18m-37 28h74',
  'M130 111q40-63 80 0m-60-2 20-37 20 37m-50 15h60', 'M170 42v80m-36-60 72 40m-72 0 72-40m-54 40h36',
] as const

export const CARD_FORMS = [
  'M50 12 61 39 88 50 61 61 50 88 39 61 12 50 39 39z', 'M50 12v76m-27-49 54 22m0-22L23 61', 'M20 50h60m-30-30v60m-19-49 38 38m0-38L31 69',
  'M50 14c-18 0-30 13-30 31v29h60V45c0-18-12-31-30-31zm-12 23h24m-12 0v37', 'M18 34h64v42H18zm0 0 32 24 32-24',
  'M50 14a36 36 0 1 0 0 72 36 36 0 0 0 0-72zm0 18v18l21-21', 'M24 76l20-28 12 13 20-34m-52 0h22m10 50h22', 'M50 15 81 34v32L50 85 19 66V34zM38 46l24 9m-24 0 24-9',
  'M50 16v68M16 50h68m-58-24 48 48m0-48L26 74', 'M28 18h44v64H28zM38 34h24M38 46h24M38 58h24', 'M17 30l33 20-33 20m66-40L50 50l33 20M50 17v66',
  'M20 20l60 60m0-60L20 80M50 12v76M12 50h76', 'M23 34a32 32 0 0 1 54 0M23 66a32 32 0 0 0 54 0M50 20v60', 'M50 14 83 50 50 86 17 50zM50 28v44m-15-22h30',
  'M50 12 86 75H14zM50 36v21m0 10v1',
] as const
