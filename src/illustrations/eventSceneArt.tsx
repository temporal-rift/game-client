import { useId } from 'react'

export type CatalogEventSceneKey =
  | 'archive' | 'general' | 'plague-ship' | 'radio' | 'chancellor' | 'ruins' | 'ceasefire'
  | 'volcano' | 'heir' | 'blueprints' | 'parliament' | 'bridge' | 'oracle' | 'soldier'
  | 'frontier' | 'trial' | 'gate' | 'fleet' | 'burning-archive' | 'resistance' | 'null-bomb'
  | 'coronation' | 'quarantine' | 'timeline' | 'double-agent' | 'probe' | 'convergence'

const ACCENTS: Record<CatalogEventSceneKey, string> = {
  archive: '#d8bd87', general: '#d59a87', 'plague-ship': '#8ed9cf', radio: '#7fc4bd', chancellor: '#d8bd87',
  ruins: '#d59a87', ceasefire: '#d8bd87', volcano: '#e98767', heir: '#d8bd87', blueprints: '#91c9d2',
  parliament: '#d8bd87', bridge: '#d8bd87', oracle: '#c6a6d8', soldier: '#d59a87', frontier: '#d8bd87',
  trial: '#c6a6d8', gate: '#7fc4bd', fleet: '#8ed9cf', 'burning-archive': '#f0a06f', resistance: '#8ed9cf',
  'null-bomb': '#9bb5e8', coronation: '#d8bd87', quarantine: '#8ed9cf', timeline: '#7fc4bd',
  'double-agent': '#cba57d', probe: '#7fc4bd', convergence: '#c6a6d8',
}

function Motif({ scene, accent, coatId }: { readonly scene: CatalogEventSceneKey; readonly accent: string; readonly coatId: string }) {
  const metal = '#8494aa'
  const dark = '#141d2e'
  switch (scene) {
    case 'archive':
    case 'burning-archive':
      return <g>
        <path d="M48 128V56l66-25 67 25v72Zm-9 0h151l12 8H27Z" fill="#283047" stroke={metal}/>
        <path d="m48 56 66-25 67 25M57 62h115M62 66v58m24-58v58m28-58v58m24-58v58m24-58v58" fill="none" stroke={metal}/>
        <path d="M106 128V93q8-13 17 0v35" fill={dark} stroke={metal}/>
        <path d="M70 73h7v16h-7m25-16h7v16h-7m38-16h7v16h-7m25-16h7v16h-7" fill={accent} opacity=".82"/>
        <path d="M231 129q-11-24 5-40-2 15 7 19-2-20 10-31 0 18 11 24 10 11 1 28Z" fill={scene === 'burning-archive' ? '#e98767' : '#192338'} stroke={scene === 'burning-archive' ? '#ffd095' : metal}/>
        <path d="M237 128q-5-12 4-21 1 10 8 12 5-10 9-12 7 11 1 21Z" fill={scene === 'burning-archive' ? '#f3ce8d' : 'none'} opacity=".9"/>
      </g>
    case 'general':
      return <g>
        <path d="M30 129h280M45 120l45-29 40 17 35-34 45 34 50-20 38 22" fill="none" stroke={metal}/>
        <path d="M87 114V72l30-21 30 21v42Zm-8 0h77" fill="#20283a" stroke={metal}/>
        <path d="M117 51V24l27 10-27 8M117 24v25" fill={accent} stroke={accent}/>
        <path d="M195 126v-30m25 30V86m23 40v-24" stroke={dark} strokeWidth="8"/>
        <circle cx="195" cy="92" r="6" fill={dark} stroke={metal}/><circle cx="220" cy="78" r="6" fill={dark} stroke={metal}/><circle cx="243" cy="98" r="6" fill={dark} stroke={metal}/>
        <path d="M189 110h12m13-13h12m11 15h12" stroke={accent}/>
      </g>
    case 'plague-ship':
      return <g>
        <path d="M0 111q49-19 94 0t91 0 83 0 72 0v44H0Z" fill="#182b3b"/>
        <path d="M14 119q28-12 56 0t56 0m57 0q28-12 56 0t56 0m-228 16q31-11 62 0t62 0m49 0q31-11 62 0t62 0" fill="none" stroke="#578e9a" opacity=".55"/>
        <path d="M78 105 276 91l-23 38-154 7Z" fill="#202d3e" stroke={metal}/>
        <path d="m103 111 60-8 30-2 58-4m-141 17 20 4m-1-6v14m14-15 21 4m-1-6v13m16-15 21 4m-1-6v12m-79-41 37-2m-22-21 30-2" fill="none" stroke="#62798c"/>
        <path d="M148 99V37l56 57Zm65-4V28l52 61Zm-95-44-25 2 25-17Z" fill="#29384a" stroke={metal}/>
        <path d="M149 37V27m65 1V18m-41 77h23" stroke={accent}/>
        <path d="M33 79q25-32 49 0m174-42q26-35 53 0m-80 25q24-28 48 0" fill="none" stroke="#8ed9cf" strokeWidth="1.5" opacity=".55"/>
        <circle cx="292" cy="84" r="17" fill="#8ed9cf" opacity=".14"/>
      </g>
    case 'fleet':
      return <g>
        <path d="M0 111q49-19 94 0t91 0 83 0 72 0v44H0Z" fill="#182b3b"/>
        <path d="M14 119q28-12 56 0t56 0m57 0q28-12 56 0t56 0m-228 16q31-11 62 0t62 0m49 0q31-11 62 0t62 0" fill="none" stroke="#578e9a" opacity=".55"/>
        <g fill="#27384b" stroke={metal}>
          <path d="M20 104h105l-15 18H39Z"/><path d="M44 101V64l33 33H44m41-34v38H54Z"/>
          <path d="M117 89h143l-19 22H133Z"/><path d="M152 86V42l41 40h-41m53-42v44h-42Z"/>
          <path d="M240 108h82l-13 15h-57Z"/><path d="M264 105V76l27 27h-27m34-28v30h-28Z"/>
        </g>
        <path d="M44 64V57m108-15v-8m112 42v-8" stroke={accent}/>
        <path d="M38 128h279" stroke="#67869a"/>
      </g>
    case 'radio':
      return <g>
        <path d="M0 129 56 106l34 10 46-23 39 21 40-16 51 18 42-17 32 14v42H0Z" fill="#243448"/>
        <path d="m166 131 28-86 28 86m-45-42h35m-43 27h49m-34-52h20" fill="none" stroke={metal} strokeWidth="1.5"/>
        <path d="M194 45V29m-8 5q8-10 16 0m-24-8q16-20 32 0m-42-7q26-30 52 0" fill="none" stroke={accent} strokeWidth="1.4"/>
        <path d="M193 44 99 128m95-84 78 84m-98-4-29 4m69-4 30 4" stroke="#61788c"/>
        <circle cx="194" cy="45" r="4" fill={accent}/>
      </g>
    case 'chancellor':
      return <g>
        <path d="M20 132h300m25-60h-34M29 72h-34" fill="none" stroke="#65758b"/>
        <path d="M111 131V79q0-32 60-32t60 32v52Zm-11 0h142" fill="#202a3d" stroke={metal}/>
        <path d="M126 130V80q0-21 45-21t45 21v50M139 87v43m32-43v43m32-43v43" fill="none" stroke={metal}/>
        <circle cx="171" cy="79" r="10" fill={dark} stroke={metal}/>
        <path d="m156 73 5-14 10 8 10-8 6 14Z" fill={accent}/>
        <path d="m146 101 25-10 25 10m-50 0v23m50-23v23m-57-1h64" fill="none" stroke={accent}/>
        <path d="M53 122q30-33 59-5m118 0q30-28 59 5" fill="none" stroke="#66778a"/>
      </g>
    case 'parliament':
      return <g>
        <path d="M34 74h272v58H34Zm-8 0h288M34 132h272" fill="#202a3d" stroke={metal}/>
        <path d="M42 121q7-30 14 0m18 0q7-30 14 0m18 0q7-30 14 0m18 0q7-30 14 0m18 0q7-30 14 0m18 0q7-30 14 0m18 0q7-30 14 0m18 0q7-30 14 0m18 0q7-30 14 0" fill="none" stroke={metal}/>
        <path d="M140 84h60v29h-60Zm-8 29h76m-64-19h48m-33-9v29m19-29v29" fill="#273348" stroke={accent}/>
        <path d="M157 83V55m26 28V55m-39 0h51m-46-8h41m-31-8h21" stroke={metal}/>
        <circle cx="117" cy="94" r="5" fill={dark} stroke={metal}/><circle cx="222" cy="94" r="5" fill={dark} stroke={metal}/>
        <path d="M107 114v-8m122 8v-8" stroke={accent}/>
      </g>
    case 'ruins':
      return <g>
        <path d="M45 130V52l21-12 13 14 18-13 11 15v74Zm89 0V66l20 8 17-19 16 18 15-9v66Zm-99 0h176" fill="#293348" stroke={metal}/>
        <path d="M54 64h10v13H54m42-12h10v16H96m47 3h12v17h-12m46-14h11v19h-11" fill={accent} opacity=".58"/>
        <path d="m37 130 24-14 16 9 16-20 15 12 16-15 15 28m0 0 18-14 16 12 16-19 21 21" fill="#192335" stroke="#69798d"/>
        <path d="M26 140h207M247 120l19-8 13 9 19-14 20 17" fill="none" stroke={metal}/>
      </g>
    case 'ceasefire':
      return <g>
        <path d="M0 128h340" stroke={metal}/>
        <path d="M69 129V79m15 50V68m-24 18 24-18 23 18m-8 61-4-32q12-14 25 0l8 32Z" fill="#1a2436" stroke={metal}/>
        <path d="M248 129V79m-15-11 15 11 23-18m-34 90 4-32q12-14 25 0l8 32Z" fill="#1a2436" stroke={metal}/>
        <path d="M106 91 164 98l-6 6-53-5m127-8-52 7 6 6 48-5" fill="none" stroke={accent} strokeWidth="2"/>
        <path d="M163 72h20m-10-10v20" stroke={accent} strokeWidth="2"/>
        <path d="M32 128v-33m0 0-13 14m13-14 13 14M306 128v-33m0 0-13 14m13-14 13 14" fill="none" stroke="#77879a"/>
      </g>
    case 'volcano':
      return <g>
        <path d="M0 134 59 84l39 25 69-80 62 81 38-36 73 56v21H0Z" fill="#344455"/>
        <path d="m103 107 64-78 62 81 34-34 77 58H72Z" fill="#243246"/>
        <path d="m151 73 16-44 10 32 17 17-22 55-31-18Z" fill="#ad6e6b"/>
        <path d="m167 29 10 32 17 17-22 55-8-11 13-39-17-16Z" fill={accent}/>
        <path d="M169 77 132 144m54-47 26 47m-44-36 5 36" stroke="#f0c787" strokeWidth="2"/>
        <path d="M0 142q70-18 137 0t203-3v16H0Z" fill="#151f31"/>
      </g>
    case 'heir':
      return <g>
        <path d="M31 132h278m-250-7V88q5-41 56-47 49 7 54 47v37" fill="#202a3d" stroke={metal}/>
        <path d="M99 125V87q5-23 30-27 27 4 31 27v38m-54-38h47m-35 39V89q5-14 13-15 10 2 14 15v36" fill="none" stroke={metal}/>
        <path d="M118 76q13-8 26 0l-2 11h-23Z" fill={accent}/>
        <circle cx="124" cy="69" r="8" fill={dark} stroke={metal}/>
        <path d="m115 62 3-11 7 7 7-7 4 12" fill="none" stroke={accent}/>
        <path d="M211 127V95q17-20 34 0v32Zm-7 0h49" fill="#293348" stroke={metal}/>
        <circle cx="228" cy="84" r="8" fill={dark} stroke={metal}/>
        <path d="m216 82 12-16 12 16m-34 42h45" fill="none" stroke="#8992a0"/>
        <path d="M168 54v70m-13-11 13 11 13-11m-13-63 4 10h10l-8 6 3 10-9-6-9 6 3-10-8-6h10Z" fill="none" stroke={accent}/>
      </g>
    case 'coronation':
      return <g>
        <path d="M54 130V60l54-27 54 27v70Zm-10 0h128" fill="#252d42" stroke={metal}/>
        <path d="m54 60 54-27 54 27m-93 8v55m26-55v55m26-55v55" fill="none" stroke={metal}/>
        <path d="M91 130V92q17-17 34 0v38" fill={dark} stroke={metal}/>
        <circle cx="108" cy="79" r="11" fill="#1a2234" stroke={metal}/>
        <path d="m96 70 4-13 8 8 8-8 5 13Z" fill={accent} stroke={accent}/>
        <path d="M212 126V79l34-19 34 19v47Zm-7 0h82" fill="#202a3c" stroke={metal}/>
        <path d="m221 77 8-12 9 10 9-13 9 15" fill="none" stroke={accent} strokeWidth="2"/>
        {scene === 'coronation' && <path d="M227 59v-9m20 4v-10m20 15v-9" stroke={accent}/ >}
      </g>
    case 'blueprints':
      return <g>
        <path d="M69 28h202v116H69Z" fill="#1a3142" stroke={accent}/>
        <path d="M79 38h182v96H79Z" fill="none" stroke="#52768b"/>
        <path d="M93 119V73l42-22 37 22v46Zm79 0V85h70v34Zm-84 0h170" fill="none" stroke="#b5d9d7" strokeWidth="1.4"/>
        <path d="M104 75h18m-18 8h18m-18 8h18m-18 8h18m-4 20V86h15v33m37-36 27 24m-27 0 27-24" fill="none" stroke={accent}/>
        <path d="M67 37h-9m9 0v-9m206 9h9m-9 0v-9M67 135h-9m9 0v9m206-9h9m-9 0v9" stroke={accent}/>
      </g>
    case 'bridge':
      return <g>
        <path d="M0 119 57 76l35 25 54-67 46 68 38-30 51 34 59-24v73H0Z" fill="#344455"/>
        <path d="M0 131q78-15 164 0t176-3v27H0Z" fill="#172333"/>
        <path d="M21 119q148-94 299 0m-297 1h296M49 103v17m39-37v37m40-55v55m42 0V69m42 27v24m43-3V91m39 28v-9" fill="none" stroke={metal} strokeWidth="1.3"/>
        <path d="m168 73 8 14-9 9 9 10-6 13" fill="none" stroke={accent} strokeWidth="2"/>
      </g>
    case 'oracle':
      return <g>
        <path d="M47 129V71l62-37 62 37v58Zm-9 0h142" fill="#242c41" stroke={metal}/>
        <path d="m47 71 62-37 62 37m-111 9h98m-83 4v39m28-39v39m29-39v39" fill="none" stroke={metal}/>
        <path d="M202 85q31-35 62 0-31 35-62 0Z" fill="#19263b" stroke={accent} strokeWidth="1.7"/>
        <circle cx="233" cy="85" r="10" fill={accent} opacity=".75"/><circle cx="233" cy="85" r="4" fill="#f4ead7"/>
        <path d="M233 67V48m-10 7q10-14 20 0m-29-6q19-24 38 0" fill="none" stroke={accent}/>
        <path d="M190 119h85" stroke={metal}/>
      </g>
    case 'soldier':
      return <g>
        <path d="M0 128h340M22 130l52-34 40 24 48-48 49 37 36-20 73 34v32H0Z" fill="#273449"/>
        <path d="M176 130 188 48m0 0 27-11m-27 11-20-10" fill="none" stroke={accent} strokeWidth="2"/>
        <circle cx="145" cy="65" r="13" fill="#1a2235" stroke={metal}/>
        <path d="m118 128 9-44q19-24 39 0l11 44Z" fill="#303b50" stroke={metal}/>
        <path d="m126 55 7-14q15-9 26 2l8 12m-33 0h33m-34 21 20 12 18-14m-17 14v38" fill="none" stroke={accent}/>
        <path d="M109 128h61m-25-34 30-11" stroke={metal}/>
      </g>
    case 'frontier':
      return <g>
        <path d="M0 126 48 105l33 12 51-27 51 27 41-22 42 22 42-16 32 14v45H0Z" fill="#29374b"/>
        <path d="M28 128V84l42-28 41 28v44Zm-8 0h99" fill="#202b3e" stroke={metal}/>
        <path d="m28 84 42-28 41 28m-68 5h53m-48 6v27m44-27v27m-31-17h17v17H61Z" fill="none" stroke={metal}/>
        <path d="M229 125V67m-13 15 13-15 13 15m-13-34v18m-9-1q9-12 18 0m-22-8q13-18 26 0" fill="none" stroke={accent}/>
        <path d="M185 128v-24m18 24V92m17 36v-20" stroke={dark} strokeWidth="6"/>
      </g>
    case 'trial':
      return <g>
        <path d="M42 130V55l66-27 67 27v75Zm-8 0h157" fill="#242c40" stroke={metal}/>
        <path d="m42 55 66-27 67 27m-121 8h107m-94 5v58m28-58v58m28-58v58m28-58v58" fill="none" stroke={metal}/>
        <path d="M211 127V88q14-18 29 0v39Zm-7 0h44" fill={dark} stroke={metal}/>
        <circle cx="223" cy="74" r="8" fill={dark} stroke={metal}/>
        <path d="M270 43v73m-26-59 26-13 26 13m-40 1-10 26h20Zm40 0-10 26h20Zm-56 49h91" fill="none" stroke={accent}/>
        <path d="M260 117h20m16 0h20" stroke={metal}/>
      </g>
    case 'gate':
      return <g>
        <path d="M100 132V65q0-49 70-49t70 49v67Zm16-1V67q0-33 54-33t54 33v64Z" fill="#1a2d3c" stroke={metal}/>
        <path d="M120 130V67q0-28 50-28t50 28v63" fill="none" stroke={accent}/>
        <ellipse cx="170" cy="83" rx="29" ry="46" fill="#64b9a9" opacity=".16"/>
        <path d="M145 110q25-52 50 0m-50-19q25 39 50 0m-38-26q13 22 26 0" fill="none" stroke="#9ce7d5"/>
        <path d="M30 135h280m-235-9-19 9m210-9 19 9" stroke={metal}/>
      </g>
    case 'resistance':
      return <g>
        <path d="M0 130 52 99l47 14 40-36 48 42 44-25 47 20 62-25v46H0Z" fill="#27364a"/>
        <path d="M125 130V62l48-28 48 28v68Zm-8 0h112" fill="#202a3e" stroke={metal}/>
        <path d="m125 62 48-28 48 28m-83 11h68m-59 5v44m28-44v44m28-44v44" fill="none" stroke={metal}/>
        <path d="M178 43v55m0-55 40 13-40 11" fill={accent} stroke={accent}/>
        <path d="M75 128v-31m24 31V86m24 42v-28" stroke={dark} strokeWidth="7"/>
        <circle cx="75" cy="92" r="5" fill={dark} stroke={metal}/><circle cx="99" cy="81" r="5" fill={dark} stroke={metal}/><circle cx="123" cy="94" r="5" fill={dark} stroke={metal}/>
      </g>
    case 'null-bomb':
      return <g>
        <path d="M0 130h340" stroke={metal}/>
        <path d="M42 130V78h48v52m159 0V69h48v61M28 130V98h14m255-18h17v50" fill="#202a3c" stroke={metal}/>
        <circle cx="170" cy="77" r="48" fill={accent} opacity=".1"/><circle cx="170" cy="77" r="29" fill="#172137" stroke={accent} strokeWidth="1.5"/>
        <circle cx="170" cy="77" r="17" fill="none" stroke={accent}/><path d="M170 55v44m-22-22h44m-38-16 32 32m0-32-32 32" stroke={accent}/>
        <path d="M170 27v-12m0 124v-12m-50-50h-13m126 0h-13m-85-35-9-9m99 99-9-9m0-81 9-9m-99 99 9-9" stroke={accent}/>
        <path d="M66 112h18m173-20h19m-221 31h37m132-6h46" stroke="#66768b"/>
      </g>
    case 'quarantine':
      return <g>
        <path d="M0 129h340" stroke={metal}/>
        <path d="M44 129V64h91v65Zm-8 0h108M53 73h72m-65 7v40m30-40v40m28-40v40" fill="#203044" stroke={metal}/>
        <path d="M175 129V79q22-22 44 0v50Zm-8 0h60" fill="#1b2a3d" stroke={accent}/>
        <path d="M181 81h32m-16-12v25m-7-13h14" stroke={accent}/>
        <path d="M236 129V53m26 76V67m25 62V42" stroke={metal}/>
        <path d="M229 74h52m-45-10h38M0 143h340" stroke="#8ed9cf" opacity=".7"/>
        <g fill="#8ed9cf" opacity=".3"><circle cx="221" cy="38" r="12"/><circle cx="300" cy="91" r="15"/></g>
      </g>
    case 'timeline':
      return <g>
        <path d="M0 132h340" stroke={metal}/>
        <path d="M30 121q51-2 84-34t66-5q31 9 49-26t78-20m-277 85q48-4 77-26t69 9q37 15 61-6t48-9" fill="none" stroke="#5a7188"/>
        <path d="M31 121q51-2 84-34t66-5q31 9 49-26t78-20m-193 84q48-4 77-26t69 9q37 15 61-6t48-9" fill="none" stroke={accent} strokeWidth="1.8"/>
        <circle cx="114" cy="87" r="5" fill={accent}/><circle cx="180" cy="82" r="5" fill={accent}/><circle cx="229" cy="56" r="5" fill={accent}/><circle cx="308" cy="36" r="5" fill={accent}/>
        <path d="m108 76 7 11-11 6m66-23 10 12-12 4m42-42 9 12-12 2" fill="none" stroke="#f1e8d3"/>
      </g>
    case 'double-agent':
      return <g>
        <path d="M34 134V66q136-75 272 0v68m-14 0V73q-122-66-244 0v61" fill="#1d293b" stroke={metal}/>
        <path d="M70 134v-25q18-22 38 0v25Zm124 0v-25q18-22 38 0v25Z" fill={`url(#${coatId})`} stroke={metal}/>
        <circle cx="89" cy="94" r="9" fill={dark} stroke={metal}/><circle cx="213" cy="94" r="9" fill={dark} stroke={metal}/>
        <path d="M76 90q12-21 25 0m100 0q12-21 25 0" fill="#30394a" stroke={metal}/>
        <path d="M112 119q42-13 78 0" fill="none" stroke={accent}/>
        <path d="m143 111h22l5 17h-28Z" fill={accent} stroke="#f1e8d3"/>
        <path d="M151 115h7m-3-3v11" stroke="#806748"/>
        <path d="M17 145h306M47 118l18 12m211-12-18 12" stroke="#62758a"/>
      </g>
    case 'probe':
      return <g>
        <path d="M0 127 45 106l42 13 42-33 38 27 46-22 48 23 43-15 36 13v33H0Z" fill="#29374a"/>
        <path d="M148 88V46l22-20 22 20v42Zm-18 0h80m-66-31h51" fill="#203146" stroke={metal}/>
        <circle cx="170" cy="58" r="10" fill={accent} opacity=".75"/><circle cx="170" cy="58" r="4" fill="#efffec"/>
        <path d="M148 48 116 34m76 14 34-18m-51 18V10m-45 92h80m-63-14-21 19m50-19 21 19" fill="none" stroke={accent}/>
        <path d="M153 89v34m34-34v34m-46 0h58" stroke={metal}/>
      </g>
    case 'convergence':
      return <g>
        <path d="M24 125q48-2 81-38t65-1q34 36 67 0t80-25m-293 75q62-1 83-27t63-17q40 10 65-17t75-22" fill="none" stroke="#4e667e"/>
        <path d="M24 125q48-2 81-38t65-1q34 36 67 0t80-25m-293 75q62-1 83-27t63-17q40 10 65-17t75-22" fill="none" stroke={accent} strokeWidth="1.7"/>
        <circle cx="170" cy="86" r="30" fill={accent} opacity=".1"/>
        <circle cx="170" cy="86" r="20" fill="#172338" stroke={accent}/>
        <path d="M156 86h28m-14-14v28m-10-24 20 20m0-20-20 20" stroke={accent}/>
        <circle cx="105" cy="86" r="4" fill="#d8bd87"/><circle cx="236" cy="86" r="4" fill="#8ed9cf"/>
      </g>
  }
}

export function CatalogEventScene({ scene, className, catalogId }: { readonly scene: CatalogEventSceneKey; readonly className: string; readonly catalogId: string }) {
  const id = useId().replaceAll(':', '')
  const accent = ACCENTS[scene]
  const sea = scene === 'plague-ship' || scene === 'fleet'
  const city = ['archive', 'chancellor', 'ruins', 'parliament', 'heir', 'trial', 'burning-archive', 'resistance', 'quarantine', 'double-agent'].includes(scene)
  const interior = ['blueprints', 'coronation', 'oracle'].includes(scene)
  const temporal = ['gate', 'timeline', 'probe', 'convergence', 'null-bomb'].includes(scene)
  let glowX = 225
  if (sea) glowX = 282
  else if (temporal) glowX = 170
  else if (city) glowX = 254
  return (
    <svg viewBox="0 0 340 155" className={className} data-catalog-id={catalogId} data-scene-key={scene} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" x2="0.2" y1="0" y2="1"><stop stopColor="#25243a"/><stop offset=".58" stopColor="#1a2638"/><stop offset="1" stopColor="#111b2c"/></linearGradient>
        <radialGradient id={`${id}-halo`}><stop stopColor={accent} stopOpacity=".33"/><stop offset="1" stopColor={accent} stopOpacity="0"/></radialGradient>
        <linearGradient id={`${id}-coat`} x1="0" x2="1" y1="0" y2="1"><stop stopColor="#3e485b"/><stop offset="1" stopColor="#171f31"/></linearGradient>
      </defs>
      <rect width="340" height="155" fill={`url(#${id}-sky)`}/>
      <ellipse cx={glowX} cy="54" rx={sea ? 88 : 95} ry="67" fill={`url(#${id}-halo)`}/>
      <g fill="#c7d0d7" opacity=".56"><circle cx="28" cy="27" r=".8"/><circle cx="71" cy="50" r=".7"/><circle cx="121" cy="21" r=".8"/><circle cx="287" cy="29" r=".8"/><circle cx="318" cy="75" r=".7"/></g>
      {sea && <g>
        <path d="M0 89q47-30 94 0t92 0 82 0 72 0v66H0Z" fill="#203648"/>
        <path d="M0 104q43-18 86 0t86 0 86 0 82 0m-340 18q43-16 86 0t86 0 86 0 82 0m-340 17q43-13 86 0t86 0 86 0 82 0" fill="none" stroke="#548a95" opacity=".48"/>
        <path d="M0 83q40-26 80 0t80 0 80 0 100 0" fill="none" stroke="#7696a2" opacity=".28"/>
      </g>}
      {city && <g>
        <path d="M0 112V73h30V61h28v51h18V81h35V52h24v60h20V68h37v44h20V54h31v58h17V77h42v35h36v43H0Z" fill="#222b3e"/>
        <path d="M5 82h8m7 0h6m11-11h8m8 0h6m-39 20h8m7 0h6m36 1h9m8 0h9m28-31h7m7 0h7m-14 13h7m7 0h7m50 4h8m8 0h8m28-25h8m8 0h7m-15 14h8m8 0h7m29 6h9m8 0h9" stroke={accent} strokeOpacity=".3"/>
        <path d="M0 116q83-14 163 0t177-2v41H0Z" fill="#192436"/>
      </g>}
      {interior && <g>
        <path d="M16 135V72q0-46 154-60 138 15 154 60v63" fill="none" stroke="#53647a" strokeOpacity=".55"/>
        <path d="M34 136V77q0-37 136-51 122 13 136 51v59m-224-1V82q0-24 88-39 81 14 88 39v53" fill="none" stroke="#53647a" strokeOpacity=".44"/>
        <path d="M0 137h340v18H0Z" fill="#192436"/>
      </g>}
      {temporal && <g>
        <path d="M0 122q54-54 109 0t108 0 123 0v33H0Z" fill="#19293a"/>
        <path d="M18 115q55-61 110 0t110 0 91-5M8 97q50-42 99 0t99 0 126-4M53 137q42-34 84 0t84 0 97-4" fill="none" stroke="#4d8790" strokeOpacity=".44"/>
        <circle cx="266" cy="44" r="26" fill="none" stroke="#5e9e9b" strokeOpacity=".24"/>
        <circle cx="266" cy="44" r="40" fill="none" stroke="#5e9e9b" strokeOpacity=".14"/>
      </g>}
      {!sea && !city && !interior && !temporal && <g>
        <path d="M0 121 36 97l30 13 41-35 34 25 44-48 44 49 40-35 34 33 37-18v74H0Z" fill="#29374a"/>
        <path d="m65 110 42-35 34 25m38-48 44 49 40-35m34 33 37-18" fill="none" stroke="#506176"/>
        <path d="M0 135q70-15 132 0t208-3v23H0Z" fill="#151f30"/>
      </g>}
      <path d="M10 143h320" stroke={accent} strokeOpacity=".52"/>
      <g fill="none" stroke="#74849a" strokeOpacity=".4"><path d="M15 20h59m-48 6h34M270 19h54m-39 6h28"/></g>
      <Motif scene={scene} accent={accent} coatId={`${id}-coat`}/>
      <path d="M0 152h340" stroke="#cba57d" strokeOpacity=".45"/>
    </svg>
  )
}
