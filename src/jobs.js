export const LOCATIONS = {
  station: { name: 'Station Soest-Zuid', pos: [0, 300], wait: [0, 307], area: 'Soest-Zuid' },
  church: { name: 'Oude Kerk', pos: [-150, -60], wait: [-150, -66], area: 'Oude Centrum' },
  palace: { name: 'Paleis Soestdijk', pos: [-240, -180], wait: [-240, -185.6], area: 'Paleislaan' },
  market: { name: 'Winkelcentrum Soest', pos: [-20, 60], wait: [-20, 54], area: 'Centrum' },
  shopping: { name: 'Winkelstraat', pos: [120, 60], wait: [120, 54], area: 'Centrum-Oost' },
  watertower: { name: 'Watertoren Soest', pos: [120, -180], wait: [120, -185.6], area: 'Watertorenpark' },
  windmill: { name: 'Molen De Windhond', pos: [-240, 60], wait: [-240, 54], area: 'Molenpark' },
  park: { name: 'Park aan de vijver', pos: [-180, 120], wait: [-186, 120], area: 'Soester Eng' },
  dunes: { name: 'Lange Duinen', pos: [300, 120], wait: [305, 120], area: 'Soesterduinen' },
  sports: { name: 'VV Hees · Sportpark', pos: [120, 180], wait: [120, 174], area: 'Sportpark Hees' },
  industrial: { name: 'Bedrijventerrein Nijverheid', pos: [-120, 180], wait: [-120, 186], area: 'Nijverheid' },
  farm: { name: 'Boerderij De Eem', pos: [-300, 260], wait: [-306, 260], area: 'Polder Eemland' },
  townhall: { name: 'Gemeentehuis Soest', pos: [120, -60], wait: [120, -66], area: 'Raadhuisplein' },
};

export const RIDES = [
  {
    pickup: 'market',
    dropoff: 'church',
    base: 13,
    passengers: [{ name: 'Noor de Vries', coat: '#d45d78', skin: '#e8b995', hair: '#3b2b23' }],
    line: 'Naar de oude kerk, graag. Ik wil de kaarsjes nog zien branden.',
    dropLine: 'Dank je. Wat een mooi licht vanavond.',
  },
  {
    pickup: 'church',
    dropoff: 'station',
    base: 15,
    passengers: [{ name: 'Lotte van Dijk', coat: '#368ba1', skin: '#f0c9a7', hair: '#6b4a35' }],
    line: 'De laatste trein, denk ik. Ik ben al veel te laat.',
    dropLine: 'Precies op tijd. Dank je wel!',
  },
  {
    pickup: 'station',
    dropoff: 'palace',
    base: 18,
    passengers: [
      { name: 'Stan Schulten', coat: '#845fb2', skin: '#e8b995', hair: '#281f1b' },
      { name: 'Vasco Wessels', coat: '#359b91', skin: '#edc39c', hair: '#d4b06a' },
    ],
    line: 'We zijn hier voor de tuinen van Soestdijk. Rij maar langs de lange kant.',
    dropLine: 'Prachtig. Bedankt voor de rustige rit.',
  },
  {
    pickup: 'palace',
    dropoff: 'dunes',
    base: 20,
    passengers: [{ name: 'Mila Jansen', coat: '#e9a83a', skin: '#f0c7a3', hair: '#3b2b23' }],
    line: 'Even uitwaaien in de duinen. Ik heb de hele dag binnen gezeten.',
    dropLine: 'Ruik je dat? Zand en dennen. Heerlijk.',
  },
  {
    pickup: 'dunes',
    dropoff: 'market',
    base: 19,
    passengers: [{ name: 'Daan Visser', coat: '#4676b8', skin: '#e4b28a', hair: '#8b6b4c' }],
    line: 'Honger. Echt honger. Breng me naar de markt, alsjeblieft.',
    dropLine: 'Nu een broodje. Bedankt!',
  },
  {
    pickup: 'sports',
    dropoff: 'station',
    base: 15,
    passengers: [{ name: 'Amir Bakker', coat: '#568d64', skin: '#e7bd9a', hair: '#3b2b23' }],
    line: 'We hebben verloren. Rij maar rustig, ik heb geen haast meer.',
    dropLine: 'Volgende week beter. Bedankt, chef.',
  },
  {
    pickup: 'market',
    dropoff: 'watertower',
    base: 17,
    passengers: [{ name: 'Emma Koster', coat: '#be6588', skin: '#f0c5a3', hair: '#d4b06a' }],
    line: 'Mijn oma woonde hier vroeger. De watertoren was haar vast punt.',
    dropLine: 'Hij is nog precies zoals ik hem herinner.',
  },
  {
    pickup: 'windmill',
    dropoff: 'shopping',
    base: 13,
    passengers: [{ name: 'Yara de Wit', coat: '#d48343', skin: '#edc09a', hair: '#6b4a35' }],
    line: 'Tulpen voor mijn moeder. Ze worden maar één keer per jaar zo mooi.',
    dropLine: 'Ze gaan het geweldig vinden. Dank je!',
  },
  {
    pickup: 'industrial',
    dropoff: 'farm',
    base: 22,
    passengers: [{ name: 'Bram de Wit', coat: '#4779a8', skin: '#c18b67', hair: '#281f1b' }],
    line: 'Naar de boerderij, alsjeblieft. De koeien wachten niet.',
    dropLine: 'Mooi op tijd voor het melken. Bedankt!',
  },
  {
    pickup: 'farm',
    dropoff: 'palace',
    base: 23,
    passengers: [{ name: 'Romy van Leeuwen', coat: '#c65c55', skin: '#efc49d', hair: '#8b6b4c' }],
    line: 'De koeien kunnen wel even zonder mij. Ik heb een afspraak bij het paleis.',
    dropLine: 'Wat een rit. De polder is zo mooi in dit licht.',
  },
  {
    pickup: 'watertower',
    dropoff: 'dunes',
    base: 19,
    passengers: [{ name: 'Finn Meijer', coat: '#62a76b', skin: '#f0c9a7', hair: '#3b2b23' }],
    line: 'Ik wil de zonsondergang vanaf de duinen zien. Denk je dat we het halen?',
    dropLine: 'We hebben het gehaald. Kijk dat licht.',
  },
  {
    pickup: 'shopping',
    dropoff: 'station',
    base: 15,
    passengers: [{ name: 'Léonard Rancourt', coat: '#62926c', skin: '#edc49e', hair: '#6b4a35' }],
    line: 'Naar Soest-Zuid, graag. Ik heb een trein te halen en jij een verhaal te vertellen.',
    dropLine: 'Volgende keer neem ik de langere route.',
  },
  {
    pickup: 'station',
    dropoff: 'townhall',
    base: 12,
    passengers: [{ name: 'Kylian Jansen', coat: '#397ca1', skin: '#bb805c', hair: '#281f1b' }],
    line: 'Gemeentehuis. Niet spannend, maar wel belangrijk.',
    dropLine: 'Bedankt. Ik ben nog net op tijd.',
  },
  {
    pickup: 'townhall',
    dropoff: 'park',
    base: 12,
    passengers: [{ name: 'Sara Bakker', coat: '#e98a3b', skin: '#edc49e', hair: '#d4b06a' }],
    line: 'Even naar het park. Ik moet een beetje bijkomen van al dat papierwerk.',
    dropLine: 'Kijk de eenden eens. Dank je wel.',
  },
];

export function passengerNames(ride) {
  return ride.passengers.map((p) => p.name.split(' ')[0]).join(' & ');
}

export function fullPassengerNames(ride) {
  return ride.passengers.map((p) => p.name).join(' & ');
}

export function rideTitle(ride) {
  const pickup = LOCATIONS[ride.pickup];
  const dropoff = LOCATIONS[ride.dropoff];
  return `${pickup.name} → ${dropoff.name}`;
}
