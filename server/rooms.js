// The rooms of the guesthouse. Prices are per night in FCFA (XAF). The Royal Apartment is real; edit the other rooms freely.
// Optional: cover (card image) and photos [{src, thumb, alt}]. Rooms with several photos get a swipeable carousel. Rooms without photos show a drawing.
module.exports = [
  {
    "id": "royal-apartment",
    "name": "Royal Apartment",
    "tagline": "Fully furnished one-bedroom apartment",
    "price": 25000,
    "capacity": 2,
    "beds": "1 double bed",
    "amenities": [
      "Air-conditioned bedroom",
      "Air conditioning in the living room",
      "Living room with sofa and TV",
      "Dining area",
      "Fully equipped kitchen (fridge, microwave, kettle, cooker)",
      "Bathroom with shower and hot water",
      "Wardrobe",
      "Marble-tiled floors"
    ],
    "description": "A bright, fully furnished apartment with a spacious air-conditioned bedroom, a stylish living room with sofa, TV and dining area, a fully equipped kitchen and a bathroom with hot water. Everything you need to feel at home, from a short stay to a longer visit.",
    "cover": "/media/apt-card.jpg",
    "photos": [
      {
        "src": "/media/apt-living.jpg",
        "alt": "Living room with sofa, TV and dining area",
        "thumb": "/media/apt-living-t.jpg"
      },
      {
        "src": "/media/apt-living2.jpg",
        "alt": "Living room in the evening light",
        "thumb": "/media/apt-living2-t.jpg"
      },
      {
        "src": "/media/apt-kitchen.jpg",
        "alt": "Fully equipped kitchen",
        "thumb": "/media/apt-kitchen-t.jpg"
      },
      {
        "src": "/media/apt-bedroom.jpg",
        "alt": "Air-conditioned bedroom",
        "thumb": "/media/apt-bedroom-t.jpg"
      },
      {
        "src": "/media/apt-bedroom2.jpg",
        "alt": "Bedroom with wooden ceiling",
        "thumb": "/media/apt-bedroom2-t.jpg"
      },
      {
        "src": "/media/apt-bathroom.jpg",
        "alt": "Bathroom with shower",
        "thumb": "/media/apt-bathroom-t.jpg"
      }
    ]
  },
  {
    "id": "royal-suite",
    "name": "Royal Suite",
    "tagline": "Our finest suite with a private lounge",
    "price": 75000,
    "capacity": 3,
    "beds": "1 king bed + sofa bed",
    "size": 55,
    "amenities": [
      "Air conditioning",
      "Wi-Fi",
      "55\" Smart TV",
      "Private lounge",
      "Hot-water bathroom with bathtub",
      "Mini fridge",
      "Balcony",
      "Breakfast included"
    ],
    "description": "A spacious suite with a king bed, separate lounge and private balcony. Fully furnished with a work desk, wardrobe and premium linen, it is perfect for special occasions and longer stays."
  },
  {
    "id": "executive-room",
    "name": "Executive Room",
    "tagline": "Comfort and workspace for business travellers",
    "price": 45000,
    "capacity": 2,
    "beds": "1 queen bed",
    "size": 32,
    "amenities": [
      "Air conditioning",
      "Wi-Fi",
      "Smart TV",
      "Work desk",
      "Hot-water shower",
      "Mini fridge",
      "Breakfast included"
    ],
    "description": "A calm, well-lit room with a queen bed and a proper work desk. Fast Wi-Fi and backup power keep you productive."
  },
  {
    "id": "deluxe-double",
    "name": "Deluxe Double",
    "tagline": "Elegant and bright for two",
    "price": 35000,
    "capacity": 2,
    "beds": "1 double bed",
    "size": 26,
    "amenities": [
      "Air conditioning",
      "Wi-Fi",
      "Smart TV",
      "Hot-water shower",
      "Wardrobe",
      "Free parking"
    ],
    "description": "A comfortable double room with tasteful furnishings, ideal for couples and short stays."
  },
  {
    "id": "family-apartment",
    "name": "Family Apartment",
    "tagline": "Two bedrooms and a full kitchenette",
    "price": 95000,
    "capacity": 5,
    "beds": "1 double bed + 2 twin beds",
    "size": 78,
    "amenities": [
      "Air conditioning",
      "Wi-Fi",
      "2 Smart TVs",
      "Kitchenette",
      "Living room",
      "2 bathrooms",
      "Washing machine",
      "Free parking"
    ],
    "description": "A fully furnished apartment for families and groups, with two bedrooms, a living room and a kitchenette so you can cook and relax like at home."
  },
  {
    "id": "garden-studio",
    "name": "Garden Studio",
    "tagline": "Quiet studio opening onto the garden",
    "price": 40000,
    "capacity": 2,
    "beds": "1 double bed",
    "size": 30,
    "amenities": [
      "Air conditioning",
      "Wi-Fi",
      "Smart TV",
      "Kitchenette",
      "Garden terrace",
      "Hot-water shower"
    ],
    "description": "A peaceful studio with its own terrace on the garden. Includes a kitchenette for longer stays."
  }
];
