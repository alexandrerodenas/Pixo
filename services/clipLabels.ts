// Candidate labels for CLIP zero-shot classification. CLIP is not tied to a fixed vocabulary:
// adding a label here is all it takes to make it recognizable. Keep each label short and concrete,
// the way it would complete "a photo of ...".

const PEOPLE = [
  'person', 'selfie', 'portrait', 'group of people', 'crowd', 'couple', 'family', 'friends', 'baby', 'toddler', 'child', 'children playing',
  'teenager', 'man', 'woman', 'elderly person', 'bride and groom', 'person smiling', 'person laughing', 'person sleeping',
  'person running', 'person dancing', 'person cooking', 'person eating', 'person working', 'person reading', 'person on a phone',
  'person swimming', 'person hiking', 'person skiing', 'person cycling', 'person playing sports', 'person playing music',
  'person on stage', 'person at the beach', 'person in a car', 'person in costume', 'hands', 'feet', 'face close-up', 'baby sleeping',
  'pregnant woman', 'newborn', 'kiss', 'hug', 'handshake', 'people at a table', 'people dancing', 'people walking', 'selfie in a mirror',
  'group selfie', 'crowd at a concert', 'audience', 'team photo', 'class photo', 'school children', 'students', 'doctor', 'police officer',
  'soldier', 'athlete', 'tourist', 'street performer', 'musician', 'chef', 'worker', 'farmer',
];

const ANIMALS = [
  'dog', 'puppy', 'cat', 'kitten', 'horse', 'pony', 'cow', 'sheep', 'goat', 'pig', 'chicken', 'duck', 'goose', 'rabbit', 'hamster', 'guinea pig',
  'bird', 'parrot', 'eagle', 'owl', 'pigeon', 'seagull', 'swan', 'flamingo', 'peacock', 'penguin', 'fish', 'goldfish', 'shark', 'dolphin', 'whale',
  'turtle', 'frog', 'lizard', 'snake', 'crocodile', 'butterfly', 'bee', 'spider', 'ant', 'insect', 'ladybug', 'dragonfly', 'snail', 'crab',
  'jellyfish', 'starfish', 'octopus', 'squirrel', 'deer', 'fox', 'wolf', 'bear', 'lion', 'tiger', 'elephant', 'giraffe', 'zebra', 'monkey',
  'gorilla', 'kangaroo', 'panda', 'camel', 'hedgehog', 'mouse', 'bat', 'zoo animal', 'farm animal', 'wild animal', 'pet', 'aquarium',
  'dog on a leash', 'dog on the beach', 'cat sleeping', 'dog in the snow', 'bird on a branch', 'animal in the wild',
];

const NATURE = [
  'landscape', 'mountain', 'snowy mountain', 'valley', 'hill', 'cliff', 'canyon', 'cave', 'volcano', 'glacier', 'beach', 'tropical beach', 'sea', 'ocean', 'waves',
  'sand dunes', 'desert', 'lake', 'river', 'waterfall', 'pond', 'swamp', 'forest', 'jungle', 'tree', 'palm tree', 'autumn leaves', 'field', 'meadow',
  'wheat field', 'vineyard', 'farmland', 'countryside', 'garden', 'flower', 'roses', 'tulips', 'sunflower', 'cherry blossom', 'lavender field', 'cactus',
  'moss', 'mushroom', 'rocks', 'island', 'coast', 'harbor', 'cliffs by the sea', 'rainbow', 'sunset', 'sunrise', 'blue sky', 'clouds', 'storm',
  'lightning', 'fog', 'snow', 'snowman', 'ice', 'frost', 'rain', 'puddle', 'night sky', 'stars', 'milky way', 'moon', 'full moon', 'northern lights',
  'sun', 'sun rays through trees', 'reflection in water', 'path in the woods', 'hiking trail', 'camping', 'tent', 'campfire', 'bonfire', 'national park',
];

const PLACES = [
  'city street', 'city skyline', 'skyscraper', 'building', 'old building', 'modern architecture', 'house', 'apartment building', 'castle', 'palace', 'church',
  'cathedral', 'mosque', 'temple', 'monument', 'statue', 'fountain', 'bridge', 'tower', 'lighthouse', 'windmill', 'ruins', 'market', 'shop window', 'shopping mall',
  'supermarket', 'restaurant', 'cafe', 'bar', 'hotel', 'hotel room', 'airport', 'train station', 'bus stop', 'subway', 'road', 'highway', 'crosswalk',
  'parking lot', 'gas station', 'park', 'playground', 'stadium', 'swimming pool', 'gym', 'school', 'classroom', 'library', 'museum', 'art gallery', 'theater',
  'cinema', 'hospital', 'office', 'factory', 'construction site', 'farm', 'barn', 'port', 'marina', 'beach bar', 'ski resort', 'ski slope', 'amusement park',
  'carousel', 'ferris wheel', 'zoo', 'cemetery', 'street at night', 'neon lights', 'old town alley', 'village', 'rooftop view', 'view from a window',
  'view from an airplane', 'balcony', 'terrace', 'courtyard',
];

const INTERIORS = [
  'living room', 'bedroom', 'kitchen', 'bathroom', 'dining room', 'child bedroom', 'home office', 'staircase', 'hallway', 'garage', 'basement', 'attic',
  'sofa', 'bed', 'table', 'chair', 'lamp', 'bookshelf', 'wardrobe', 'mirror', 'fireplace', 'christmas tree', 'curtains', 'carpet', 'wall decoration',
  'refrigerator', 'washing machine', 'oven', 'television', 'plants indoors', 'messy room', 'furniture in a store',
];

const VEHICLES = [
  'car', 'sports car', 'vintage car', 'taxi', 'truck', 'van', 'bus', 'motorcycle', 'scooter', 'bicycle', 'electric bike', 'train', 'tram', 'subway train',
  'airplane', 'helicopter', 'hot air balloon', 'boat', 'sailboat', 'cruise ship', 'ferry', 'kayak', 'canoe', 'jet ski', 'tractor', 'bulldozer', 'ambulance',
  'fire truck', 'police car', 'car interior', 'car dashboard', 'license plate', 'traffic jam', 'road sign', 'wheel', 'engine', 'car crash', 'broken car',
  'car being repaired', 'parked cars', 'racing car', 'camper van',
];

const FOOD = [
  'food', 'meal', 'breakfast', 'lunch', 'dinner', 'pizza', 'burger', 'sandwich', 'pasta', 'rice dish', 'sushi', 'salad', 'soup', 'steak', 'chicken dish',
  'fish dish', 'seafood', 'french fries', 'cheese', 'bread', 'croissant', 'cake', 'birthday cake', 'cupcake', 'cookies', 'chocolate', 'ice cream',
  'dessert', 'pastry', 'fruit', 'apple', 'banana', 'strawberry', 'orange', 'grapes', 'watermelon', 'vegetables', 'tomato', 'potatoes', 'eggs', 'pancakes',
  'barbecue', 'grilled meat', 'street food', 'buffet', 'picnic', 'wine', 'wine glasses', 'beer', 'cocktail', 'coffee', 'tea', 'juice', 'water bottle',
  'cooking in a kitchen', 'ingredients', 'recipe', 'menu', 'restaurant table', 'plate of food', 'homemade dish', 'candy', 'nuts', 'honey', 'jam',
  'champagne', 'bottle', 'glass of water',
];

const EVENTS = [
  'party', 'birthday party', 'wedding', 'wedding dress', 'baptism', 'graduation', 'christmas', 'christmas gifts', 'halloween', 'easter', 'new year fireworks',
  'fireworks', 'festival', 'carnival', 'parade', 'concert', 'dj set', 'club', 'karaoke', 'theater play', 'circus', 'magic show', 'sports match', 'football match',
  'soccer', 'basketball', 'tennis', 'golf', 'rugby', 'swimming', 'running', 'marathon', 'cycling race', 'skiing', 'snowboarding', 'surfing', 'diving', 'yoga',
  'boxing', 'climbing', 'horse riding', 'skateboarding', 'gymnastics', 'dance performance', 'family gathering', 'barbecue with friends', 'meeting', 'conference',
  'presentation', 'demonstration', 'protest', 'ceremony', 'funeral', 'holiday trip', 'road trip', 'camping trip', 'city trip', 'sightseeing', 'souvenir',
  'gift', 'balloons', 'candles', 'flowers bouquet', 'decorations',
];

const OBJECTS = [
  'phone', 'smartphone screen', 'laptop', 'computer screen', 'keyboard', 'tablet', 'camera', 'headphones', 'television', 'game console', 'video game',
  'robot', 'drone', 'watch', 'jewelry', 'glasses', 'sunglasses', 'hat', 'bag', 'backpack', 'suitcase', 'wallet', 'keys', 'umbrella', 'shoes', 'sneakers',
  'clothing', 'dress', 'jacket', 't-shirt', 'jeans', 'swimsuit', 'costume', 'mask', 'makeup', 'perfume', 'toy', 'lego', 'doll', 'teddy bear', 'puzzle',
  'board game', 'playing cards', 'book', 'magazine', 'newspaper', 'notebook', 'pen', 'pencil', 'scissors', 'tool', 'hammer', 'screwdriver', 'toolbox',
  'paint', 'brush', 'musical instrument', 'guitar', 'piano', 'violin', 'drums', 'microphone', 'speaker', 'candle', 'vase', 'clock', 'painting on a wall',
  'sculpture', 'mirror', 'bottle', 'cup', 'plate', 'cutlery', 'pot', 'pan', 'basket', 'box', 'package', 'gift box', 'bag of groceries', 'shopping cart',
  'price tag', 'product on a white background', 'product in a box', 'item for sale', 'electronic device', 'cable', 'battery', 'light bulb', 'plant pot',
  'medicine', 'pills', 'syringe', 'thermometer', 'first aid kit', 'bicycle helmet', 'ball', 'tennis racket', 'fishing rod', 'ski equipment', 'tent',
  'sleeping bag', 'binoculars', 'map', 'compass', 'flag',
];

const DOCUMENTS = [
  'screenshot', 'phone screenshot', 'chat screenshot', 'social media post', 'app screen', 'website', 'map screenshot', 'photo of a screen', 'document',
  'scanned document', 'paper document', 'receipt', 'invoice', 'bill', 'ticket', 'boarding pass', 'train ticket', 'concert ticket', 'ID card', 'passport',
  'driver license', 'credit card', 'bank statement', 'contract', 'letter', 'form', 'prescription', 'medical report', 'x-ray', 'test result', 'business card',
  'text', 'handwriting', 'handwritten note', 'sticky note', 'whiteboard', 'blackboard', 'slide presentation', 'table of numbers', 'spreadsheet', 'chart',
  'diagram', 'floor plan', 'schedule', 'timetable', 'poster', 'flyer', 'sign', 'street sign', 'shop sign', 'menu board', 'label', 'barcode', 'qr code',
  'book page', 'sheet music', 'recipe card', 'homework', 'drawing by a child', 'certificate', 'calendar', 'notes', 'to-do list', 'code on a screen',
  'terminal window', 'video call', 'email', 'conversation',
];

const ART = [
  'drawing', 'sketch', 'painting', 'watercolor', 'oil painting', 'illustration', 'cartoon', 'comic', 'anime', 'digital art', 'logo', 'icon', 'graphic design',
  'pattern', 'texture', 'wallpaper', 'abstract art', 'street art', 'graffiti', 'tattoo', 'sculpture', 'mosaic', 'stained glass', 'photo of a painting',
  'meme', 'funny picture', 'quote', 'motivational quote', 'greeting card', 'sticker', 'emoji', 'infographic', 'collage', 'black and white photo',
  'old photograph', 'vintage photo', 'film photo', 'polaroid', 'panorama', 'long exposure', 'macro close-up', 'aerial view', 'drone photo',
  'silhouette', 'bokeh', 'minimalist photo', 'artistic photo', 'photo of a photo', 'AI generated image', 'video game screenshot', '3d render',
];

const WORK_AND_HOME = [
  'office desk', 'workspace', 'computer setup', 'meeting room', 'construction', 'building work', 'renovation', 'painting a wall', 'repair', 'plumbing',
  'electrical wiring', 'broken object', 'damage', 'stain', 'leak', 'mold', 'crack in a wall', 'insurance claim photo', 'moving boxes', 'shopping',
  'groceries', 'laundry', 'cleaning', 'garden work', 'lawn', 'vegetable garden', 'greenhouse', 'bbq grill', 'swimming pool at home', 'pet food',
  'pet toys', 'baby clothes', 'baby bottle', 'stroller', 'crib', 'school supplies', 'backpack for school', 'homework desk',
];

// Labels that are not worth showing: they let CLIP say "none of the above" instead of forcing a
// wrong specific label on photos that do not fit the list. They count in the scores but are not returned.
export const CLIP_OTHER_LABELS: string[] = [
  'blurry photo', 'dark photo', 'overexposed photo', 'out of focus photo', 'accidental photo', 'photo of the floor', 'photo of the ceiling', 'photo of a pocket',
  'photo of nothing in particular', 'random everyday object', 'close-up of something unclear', 'low quality photo', 'photo with a finger over the lens',
  'photo of a wall', 'photo taken by mistake', 'unclear scene', 'cluttered scene',
];

export const CLIP_LABELS: string[] = Array.from(new Set([
  ...PEOPLE, ...ANIMALS, ...NATURE, ...PLACES, ...INTERIORS, ...VEHICLES, ...FOOD, ...EVENTS, ...OBJECTS, ...DOCUMENTS, ...ART, ...WORK_AND_HOME,
]));
