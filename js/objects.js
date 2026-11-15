// Central config. targetIndex = order of images when compiling targets.mind (first image = 0).
export const OBJECTS = [
  { id:"dinosaur", name:"Dinosaur", targetIndex:0, model:"assets/models/dinosaur.glb", targetImage:"assets/images/dinosaur-card.jpg",
    scale:"0.5 0.5 0.5", position:"0 0 0", rotation:"0 0 0",
    blurb:"Meet a giant of the Mesozoic.",
    facts:[["Classification","Dinosauria, Theropoda"],["Period","Mesozoic Era"],["Habitat","Forests and plains"],["Diet","Carnivore"]],
    trivia:["Many theropods were related to modern birds.","Dinosaurs lived on Earth for over 160 million years."] },
  { id:"heart", name:"Human Heart", targetIndex:1, model:"assets/models/heart.glb", targetImage:"assets/images/heart-card.jpg",
    scale:"0.5 0.5 0.5", position:"0 0 0", rotation:"0 0 0",
    blurb:"See how your heart pumps blood.",
    facts:[["Function","Pumps blood around the body"],["Chambers","Two atria, two ventricles"],["Circulation","Body, then lungs, then body"],["Key parts","Aorta, vena cava, valves"]],
    trivia:["Your heart beats about 100,000 times a day.","It is roughly the size of your fist."] },
  { id:"solar-system", name:"Solar System", targetIndex:2, model:"assets/models/solar-system.glb", targetImage:"assets/images/solar-system-card.jpg",
    scale:"0.5 0.5 0.5", position:"0 0 0", rotation:"0 0 0",
    blurb:"Travel from the Sun to Neptune.",
    facts:[["Star","The Sun"],["Order","Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune"],["Orbits","All planets circle the Sun"],["Largest","Jupiter"]],
    trivia:["Light from the Sun takes about 8 minutes to reach Earth.","Venus spins backwards compared with most planets."] }
];
