// Exam Words 2026 data v2 — с подтемами для General
// Структура: каждый термин имеет тему (subtopic) внутри своей категории
// Все 330 терминов — те же что в PDF, только с новым тегом subtopic

const SUBTOPICS = {
  brakes: { en: "Brakes & transmission", ru: "Тормоза и трансмиссия" },
  lights: { en: "Lights & signals", ru: "Освещение и сигналы" },
  road: { en: "Road & markings", ru: "Дорога и разметка" },
  signs: { en: "Signs & traffic rules", ru: "Знаки и правила" },
  vehicle: { en: "Vehicle parts", ru: "Части автомобиля" },
  steering: { en: "Steering & wheels", ru: "Руль и колёса" },
  situations: { en: "Driving situations", ru: "Дорожные ситуации" },
  docs: { en: "Documents & legal", ru: "Документы и право" },
  safety: { en: "Safety & emergency", ru: "Безопасность и ЧП" },
  misc: { en: "Other terms", ru: "Прочее" }
};

const DICTIONARY = {
  "general": {
    "title": "Generelt",
    "title_en": "General",
    "title_ru": "Общие термины",
    "icon": "🚗",
    "items": [
      // BRAKES & TRANSMISSION
      { dk: "bremsebelægning", en: "Brake lining", ru: "тормозная накладка", topic: "brakes" },
      { dk: "bremseforstærker", en: "Vacuum brake booster", ru: "вакуумный усилитель тормозов", topic: "brakes" },
      { dk: "bremselængde", en: "Braking distance", ru: "тормозной путь", topic: "brakes" },
      { dk: "bremseskiver / bremseklodser", en: "Brake discs / Brake pads", ru: "тормозные диски / тормозные колодки", topic: "brakes" },
      { dk: "bremsetromler / bremsebakker", en: "Brake drums / Brake shoes", ru: "тормозные барабаны / барабанные колодки", topic: "brakes" },
      { dk: "bremsevæske", en: "Brake fluid", ru: "тормозная жидкость", topic: "brakes" },
      { dk: "bremsevæskebeholder", en: "Brake fluid reservoir", ru: "бачок тормозной жидкости", topic: "brakes" },
      { dk: "driftsbremse", en: "Service brake", ru: "рабочий тормоз", topic: "brakes" },
      { dk: "hjulcylinder", en: "Wheel cylinder", ru: "колёсный тормозной цилиндр", topic: "brakes" },
      { dk: "koblingspunkt", en: "Clutch engagement point", ru: "точка схватывания сцепления («полусцепление»)", topic: "brakes" },
      { dk: "kontrollampen for ABS-bremsesystem", en: "Warning light for the ABS braking system", ru: "контрольная лампа системы ABS", topic: "brakes" },
      { dk: "nødbremse", en: "Emergency brake", ru: "аварийный тормоз", topic: "brakes" },
      { dk: "parkeringsbremse", en: "Parking brake", ru: "стояночный тормоз, ручник", topic: "brakes" },
      { dk: "rul med kobling nedtrådt", en: "Freewheel / Coasting", ru: "движение накатом с выжатым сцеплением", topic: "brakes" },
      { dk: "selvjusterende", en: "Self-adjusting", ru: "саморегулирующийся", topic: "brakes" },
      { dk: "to-kreds driftsbremse", en: "Dual-circuit service brake", ru: "двухконтурный рабочий тормоз", topic: "brakes" },
      { dk: "to-kredsbremse", en: "Dual-circuit brake", ru: "двухконтурный тормоз", topic: "brakes" },
      { dk: "vakuumforstærket", en: "Vacuum-boosted servo brakes", ru: "тормоза с вакуумным усилителем", topic: "brakes" },

      // LIGHTS & SIGNALS
      { dk: "baglys", en: "Rear light / Tail light", ru: "задний габаритный фонарь", topic: "lights" },
      { dk: "baklys", en: "Reversing light", ru: "фонарь заднего хода", topic: "lights" },
      { dk: "blinklys", en: "Blinkers / Indicators", ru: "указатели поворота, поворотники", topic: "lights" },
      { dk: "blinksignal", en: "Flashing light", ru: "мигающий сигнал", topic: "lights" },
      { dk: "bremselys", en: "Brake light", ru: "стоп-сигнал", topic: "lights" },
      { dk: "fjernlys", en: "High beam", ru: "дальний свет фар", topic: "lights" },
      { dk: "gul(e) lys", en: "Amber light(s)", ru: "жёлтый свет светофора", topic: "lights" },
      { dk: "havariblink", en: "Hazard warning lights", ru: "аварийная сигнализация", topic: "lights" },
      { dk: "højre svingspil", en: "Right-turn signal", ru: "правый указатель поворота", topic: "lights" },
      { dk: "lygtetændingstid", en: "Lighting-up time", ru: "время обязательного включения фар", topic: "lights" },
      { dk: "lyskryds", en: "Traffic lights", ru: "светофор (на перекрёстке)", topic: "lights" },
      { dk: "lysregulerede kryds", en: "Traffic light-controlled intersection", ru: "перекрёсток со светофором", topic: "lights" },
      { dk: "lyssignal", en: "Traffic light", ru: "сигнал светофора", topic: "lights" },
      { dk: "minusgrønt-signal", en: "Minus-green signal", ru: "минус-зелёный сигнал (стрелка)", topic: "lights" },
      { dk: "nærlys", en: "Low-beam headlights", ru: "ближний свет фар", topic: "lights" },
      { dk: "positionslys", en: "Position lights", ru: "габаритные огни", topic: "lights" },
      { dk: "reflekser", en: "Reflectors", ru: "светоотражатели", topic: "lights" },
      { dk: "signalanordning", en: "Signal device", ru: "сигнальное устройство", topic: "lights" },
      { dk: "venstre svingspil", en: "Left-turn signal", ru: "левый указатель поворота", topic: "lights" },
      { dk: "vognbanesignal", en: "Lane signal", ru: "сигнал для полосы", topic: "lights" },

      // ROAD & MARKINGS
      { dk: "busbane", en: "Bus lane", ru: "полоса для автобусов", topic: "road" },
      { dk: "bump", en: "Speed bump", ru: "лежачий полицейский", topic: "road" },
      { dk: "cykelfeltet (blåt)", en: "Blue bicycle lane", ru: "синяя велополоса (на перекрёстке)", topic: "road" },
      { dk: "cykelsti", en: "Bicycle lane / path", ru: "велодорожка", topic: "road" },
      { dk: "fodgængerfelt", en: "Crosswalk", ru: "пешеходный переход", topic: "road" },
      { dk: "fortov", en: "Sidewalk / Pavement", ru: "тротуар", topic: "road" },
      { dk: "frakørselsbane", en: "Exit lane / Off-ramp", ru: "полоса съезда", topic: "road" },
      { dk: "grusvej", en: "Gravel road", ru: "гравийная дорога", topic: "road" },
      { dk: "hajtænder", en: "Yield line / Give way line", ru: "«акульи зубы» — разметка уступи дорогу", topic: "road" },
      { dk: "helle med græs", en: "Traffic island with grass", ru: "островок безопасности с травой", topic: "road" },
      { dk: "kantlinje", en: "Solid side line", ru: "сплошная краевая линия", topic: "road" },
      { dk: "kantsten", en: "Curb", ru: "бордюр", topic: "road" },
      { dk: "krybespor", en: "Crawler lane", ru: "полоса для медленного транспорта (на подъёме)", topic: "road" },
      { dk: "krydset", en: "Intersection / Junction", ru: "перекрёсток", topic: "road" },
      { dk: "kørebanen", en: "Roadway", ru: "проезжая часть", topic: "road" },
      { dk: "kørebanestriber", en: "Road markings", ru: "дорожная разметка", topic: "road" },
      { dk: "letbane", en: "Light rail", ru: "лёгкое метро, скоростной трамвай", topic: "road" },
      { dk: "markvej", en: "Dirt road", ru: "грунтовая дорога", topic: "road" },
      { dk: "metaldæksler", en: "Manhole covers", ru: "канализационные люки", topic: "road" },
      { dk: "midterrabat", en: "Median", ru: "разделительная полоса", topic: "road" },
      { dk: "motortrafikvej", en: "Expressway / Carriageway", ru: "автомагистраль (без статуса motorvej)", topic: "road" },
      { dk: "motorvej", en: "Motorway", ru: "автомагистраль", topic: "road" },
      { dk: "nødspor", en: "Emergency lane", ru: "полоса аварийной остановки", topic: "road" },
      { dk: "p-pladsen", en: "Parking area / Parking lot", ru: "парковка", topic: "road" },
      { dk: "punkterede linje", en: "Broken line", ru: "прерывистая линия", topic: "road" },
      { dk: "rabat", en: "Shoulder", ru: "обочина", topic: "road" },
      { dk: "rasteplads", en: "Rest area", ru: "зона отдыха (на трассе)", topic: "road" },
      { dk: "rundkørsel", en: "Roundabout", ru: "круговое движение", topic: "road" },
      { dk: "spærreflade", en: "Hatched road markings", ru: "разметка «вафля» / зебра-заштрихованная зона", topic: "road" },
      { dk: "spærrelinje", en: "Solid line", ru: "сплошная линия разметки", topic: "road" },
      { dk: "spærrelinje, dobbelt", en: "Double solid line", ru: "двойная сплошная", topic: "road" },
      { dk: "stiplet linje", en: "Broken / Dotted line", ru: "пунктирная линия", topic: "road" },
      { dk: "stoplinje", en: "Stop line", ru: "стоп-линия", topic: "road" },
      { dk: "T-kryds", en: "T-junction", ru: "Т-образный перекрёсток", topic: "road" },
      { dk: "varslingslinje", en: "Hazard / Warning lines", ru: "предупреждающая разметка (длинный пунктир)", topic: "road" },
      { dk: "vejafmærkning", en: "Road markings", ru: "дорожная разметка", topic: "road" },
      { dk: "vejarbejde", en: "Road construction", ru: "дорожные работы", topic: "road" },
      { dk: "vejsving", en: "Curved road or turn", ru: "поворот дороги", topic: "road" },
      { dk: "vejudformningen", en: "Shape of the road", ru: "конфигурация дороги", topic: "road" },
      { dk: "venstre svingsbane", en: "Left-turn lane", ru: "полоса для поворота налево", topic: "road" },
      { dk: "vognbanen længst til venstre", en: "Far left lane", ru: "крайняя левая полоса", topic: "road" },
      { dk: "vognbanestriber", en: "Lane markings", ru: "разметка полос", topic: "road" },
      { dk: "indsnævret vej", en: "Narrow road", ru: "сужение дороги", topic: "road" },
      { dk: "jernbaneoverkørsel", en: "Railroad crossing", ru: "железнодорожный переезд", topic: "road" },
      { dk: "jernbaneoverkørsel uden bomme", en: "Railroad crossing without barriers", ru: "ж/д переезд без шлагбаума", topic: "road" },
      { dk: "enkeltsporet jernbane", en: "Single-track railroad", ru: "однопутная железная дорога", topic: "road" },
      { dk: "flersporet jernbane", en: "Multi-track railroad", ru: "многопутная железная дорога", topic: "road" },

      // SIGNS & TRAFFIC RULES
      { dk: "advarselstrekant", en: "Warning triangle", ru: "знак аварийной остановки (треугольник)", topic: "signs" },
      { dk: "forbudstavl", en: "Prohibition sign", ru: "запрещающий знак", topic: "signs" },
      { dk: "færdselstavle", en: "Traffic sign", ru: "дорожный знак", topic: "signs" },
      { dk: "hastighedstavle", en: "Speed limit sign", ru: "знак ограничения скорости", topic: "signs" },
      { dk: "højre vigepligt", en: "Give way to traffic from the right", ru: "помеха справа (уступить правому)", topic: "signs" },
      { dk: "indkørsel forbudt", en: "No entry", ru: "въезд запрещён («кирпич»)", topic: "signs" },
      { dk: "påbudt", en: "Mandatory", ru: "обязательный, предписывающий", topic: "signs" },
      { dk: "sammenfletningsregel", en: "Merge rule", ru: "правило перестроения / слияния полос", topic: "signs" },
      { dk: "sidevejene har ubetinget vigepligt", en: "Traffic from the side roads must give way", ru: "транспорт с боковых дорог обязан уступить", topic: "signs" },
      { dk: "stoppligt", en: "Duty to stop", ru: "обязанность остановиться", topic: "signs" },
      { dk: "tilladt", en: "Permitted", ru: "разрешённый", topic: "signs" },
      { dk: "ubetinget vigepligt", en: "Duty to give way to all traffic", ru: "уступить дорогу всем", topic: "signs" },
      { dk: "u-vending forbudt", en: "No U-turn", ru: "разворот запрещён", topic: "signs" },
      { dk: "vending forbudt", en: "No turning", ru: "поворот запрещён", topic: "signs" },
      { dk: "vigepligtsforhold", en: "Rules for the duty to give way", ru: "правила приоритета / уступления", topic: "signs" },
      { dk: "undertavle", en: "Supplementary traffic sign", ru: "табличка под знаком", topic: "signs" },
      { dk: "hastighedsbegrænser", en: "Speed limiter", ru: "ограничитель скорости", topic: "signs" },
      { dk: "tættere bebygget område", en: "Built-up area", ru: "населённый пункт", topic: "signs" },
      { dk: "opnå tilladt hastighed", en: "Achieve / obtain permitted speed", ru: "достичь разрешённой скорости", topic: "signs" },
      { dk: "opholds- og legeområde", en: "Residential area", ru: "жилая зона / зона отдыха и игр", topic: "signs" },

      // VEHICLE PARTS
      { dk: "afskærmning", en: "Wheel covers", ru: "крылья, кожухи колёс", topic: "vehicle" },
      { dk: "akkumulator", en: "Battery", ru: "аккумулятор", topic: "vehicle" },
      { dk: "akseltryk", en: "Axle load", ru: "нагрузка на ось", topic: "vehicle" },
      { dk: "kofanger", en: "Bumper, front/rear", ru: "бампер передний / задний", topic: "vehicle" },
      { dk: "kølerhjelm", en: "Hood / Bonnet", ru: "капот", topic: "vehicle" },
      { dk: "skærm", en: "Fender, front/rear", ru: "крыло переднее / заднее", topic: "vehicle" },
      { dk: "varmluftblæser", en: "Fan heater / Defroster", ru: "обдув / обогреватель стёкол", topic: "vehicle" },
      { dk: "vasker og viskere", en: "Windscreen washer and wipers", ru: "омыватель и стеклоочистители", topic: "vehicle" },
      { dk: "spejlet", en: "Mirror", ru: "зеркало", topic: "vehicle" },
      { dk: "førerspejl", en: "Rear view mirror", ru: "зеркало заднего вида (салонное)", topic: "vehicle" },
      { dk: "udvendige spejle", en: "Exterior mirrors", ru: "наружные зеркала", topic: "vehicle" },
      { dk: "førersædet", en: "Driver's seat", ru: "водительское сиденье", topic: "vehicle" },
      { dk: "nakkestøtte", en: "Headrest", ru: "подголовник", topic: "vehicle" },
      { dk: "sikkerhedssele", en: "Seat belt", ru: "ремень безопасности", topic: "vehicle" },
      { dk: "ildslukker", en: "Fire extinguisher", ru: "огнетушитель", topic: "vehicle" },
      { dk: "opbygningen", en: "Construction", ru: "конструкция (ТС)", topic: "vehicle" },
      { dk: "energiforbrug", en: "Fuel consumption", ru: "расход топлива / энергии", topic: "vehicle" },
      { dk: "energirigtig", en: "Energy-efficient", ru: "энергоэффективный", topic: "vehicle" },
      { dk: "miljørigtig", en: "Environmentally friendly / Eco-friendly", ru: "экологичный", topic: "vehicle" },
      { dk: "bæreevne", en: "Load capacity", ru: "грузоподъёмность", topic: "vehicle" },
      { dk: "totalvægt", en: "Gross vehicle weight (GVW)", ru: "полная разрешённая масса", topic: "vehicle" },
      { dk: "køreklare vægt", en: "Curb weight", ru: "снаряжённая масса автомобиля", topic: "vehicle" },
      { dk: "gods", en: "Goods / Cargo", ru: "груз", topic: "vehicle" },
      { dk: "udragende læs", en: "Oversized load", ru: "выступающий груз", topic: "vehicle" },
      { dk: "sikker anbringelse", en: "Secure placement", ru: "надёжное закрепление", topic: "vehicle" },
      { dk: "lastbil", en: "Truck", ru: "грузовик", topic: "vehicle" },
      { dk: "personbil", en: "Passenger car", ru: "легковой автомобиль", topic: "vehicle" },
      { dk: "knallert", en: "Moped", ru: "мопед", topic: "vehicle" },
      { dk: "stor knallert", en: "Large moped", ru: "большой мопед (45 км/ч)", topic: "vehicle" },
      { dk: "el-løbehjul", en: "Electric scooter", ru: "электросамокат", topic: "vehicle" },
      { dk: "vogntog", en: "Truck and trailer", ru: "автопоезд", topic: "vehicle" },

      // STEERING & WHEELS
      { dk: "diagonaldæk", en: "Diagonal tires", ru: "диагональные шины", topic: "steering" },
      { dk: "radialdæk", en: "Radial tire", ru: "радиальная шина", topic: "steering" },
      { dk: "fælg", en: "Rim", ru: "обод колеса, диск", topic: "steering" },
      { dk: "forhjulslejer", en: "Front wheel bearings", ru: "подшипники передних колёс", topic: "steering" },
      { dk: "hjulenes sporing", en: "Wheel alignment", ru: "развал-схождение колёс", topic: "steering" },
      { dk: "hjulophæng", en: "Wheel suspension", ru: "подвеска колеса", topic: "steering" },
      { dk: "støddæmpere", en: "Shock absorbers", ru: "амортизаторы", topic: "steering" },
      { dk: "bærekugle", en: "Ball joint", ru: "шаровая опора", topic: "steering" },
      { dk: "ratslør", en: "Play in the steering wheel", ru: "люфт руля", topic: "steering" },
      { dk: "ratstamme", en: "Steering column", ru: "рулевая колонка", topic: "steering" },
      { dk: "servostyring", en: "Power steering", ru: "усилитель руля", topic: "steering" },
      { dk: "slør", en: "Play", ru: "люфт", topic: "steering" },
      { dk: "styreegenskaber", en: "Steering characteristics", ru: "управляемость", topic: "steering" },
      { dk: "styreforbindelse", en: "Steering connection", ru: "рулевые соединения", topic: "steering" },
      { dk: "styrehus", en: "Steering gearbox", ru: "рулевой механизм", topic: "steering" },
      { dk: "styrekugle", en: "Tie rod", ru: "рулевая тяга, шаровой шарнир", topic: "steering" },
      { dk: "styretøj", en: "Steering unit", ru: "рулевое управление", topic: "steering" },
      { dk: "tandstang", en: "Steering rack", ru: "рулевая рейка", topic: "steering" },
      { dk: "slidindikator", en: "Treadwear indicator", ru: "индикатор износа протектора", topic: "steering" },
      { dk: "slidt", en: "Worn", ru: "изношенный", topic: "steering" },
      { dk: "retningsstabil", en: "Directional stability", ru: "курсовая устойчивость", topic: "steering" },
      { dk: "vandring", en: "Travel (e.g. pedal travel)", ru: "ход (педали и т.п.)", topic: "steering" },

      // DRIVING SITUATIONS
      { dk: "accelerere", en: "Accelerate", ru: "ускоряться, разгоняться", topic: "situations" },
      { dk: "bakke rundt om hjørnet", en: "Reverse around the corner", ru: "сдавать задним ходом за угол", topic: "situations" },
      { dk: "forankørende", en: "Vehicle in front", ru: "впереди идущий автомобиль", topic: "situations" },
      { dk: "forude", en: "Ahead / Up ahead", ru: "впереди", topic: "situations" },
      { dk: "frem mod / nærme sig", en: "Approach", ru: "приближаться", topic: "situations" },
      { dk: "fri bane", en: "Clear lane / All clear", ru: "свободная полоса, путь свободен", topic: "situations" },
      { dk: "kørende", en: "Traffic", ru: "движущийся транспорт", topic: "situations" },
      { dk: "kørselsformål", en: "Driving purpose", ru: "цель поездки", topic: "situations" },
      { dk: "kørselsretning", en: "Driving direction", ru: "направление движения", topic: "situations" },
      { dk: "kø", en: "Traffic congestion / Traffic jam", ru: "пробка, затор", topic: "situations" },
      { dk: "ligeud", en: "Straight ahead", ru: "прямо", topic: "situations" },
      { dk: "lukke af for cyklister", en: "Block for bicyclists", ru: "перекрыть проезд велосипедистам", topic: "situations" },
      { dk: "manglende justering", en: "Poor adjustment", ru: "плохая регулировка", topic: "situations" },
      { dk: "manglende orientering", en: "Lack of orientation", ru: "недостаточная ориентация (наблюдение)", topic: "situations" },
      { dk: "modkørende", en: "Oncoming traffic", ru: "встречный транспорт", topic: "situations" },
      { dk: "modsatte bane", en: "Opposite lane", ru: "встречная полоса", topic: "situations" },
      { dk: "trafikafvikling", en: "Flow of traffic", ru: "поток движения", topic: "situations" },
      { dk: "trafikanter", en: "Road users", ru: "участники дорожного движения", topic: "situations" },
      { dk: "transport", en: "Transport", ru: "транспортировка, перевозка", topic: "situations" },
      { dk: "tøvende", en: "Hesitant", ru: "нерешительный", topic: "situations" },
      { dk: "småbørn", en: "Young children", ru: "маленькие дети", topic: "situations" },
      { dk: "parat", en: "Ready", ru: "готовый", topic: "situations" },
      { dk: "indstillet", en: "Adjusted", ru: "отрегулированный, настроенный", topic: "situations" },
      { dk: "skrå", en: "Diagonal", ru: "наклонный, диагональный", topic: "situations" },
      { dk: "anordning", en: "Device", ru: "устройство, приспособление", topic: "situations" },
      { dk: "havneplads", en: "Harbour / Port area", ru: "портовая территория", topic: "situations" },
      { dk: "tønder", en: "Barrels", ru: "бочки (дорожные)", topic: "situations" },
      { dk: "kamera", en: "Camera", ru: "камера (видеофиксации)", topic: "situations" },
      { dk: "værksted", en: "Garage / Repair shop", ru: "автосервис, мастерская", topic: "situations" },
      { dk: "køretøjsbetjening", en: "Vehicle operation", ru: "управление транспортным средством", topic: "situations" },

      // DOCUMENTS & LEGAL
      { dk: "ansøgning", en: "Application", ru: "заявление, заявка", topic: "docs" },
      { dk: "bedømmelsesskema", en: "Evaluation form", ru: "оценочный лист (на экзамене)", topic: "docs" },
      { dk: "bestemmelse", en: "Rules / Requirement", ru: "правило, предписание", topic: "docs" },
      { dk: "betinget frakendelse af kørekort", en: "Suspended driver's license", ru: "условное лишение водительских прав", topic: "docs" },
      { dk: "cpr-nummer", en: "Social Security Number", ru: "CPR-номер (датский личный номер)", topic: "docs" },
      { dk: "kørekort", en: "Driver's license", ru: "водительские права", topic: "docs" },
      { dk: "lektionsplan", en: "Logbook", ru: "журнал учебных занятий", topic: "docs" },
      { dk: "lovbestemmelse", en: "Legal provision", ru: "законодательное положение", topic: "docs" },
      { dk: "lovkrav", en: "Legal requirement", ru: "требование закона", topic: "docs" },
      { dk: "parkeringsskive", en: "Parking disc", ru: "парковочный диск (Дания)", topic: "docs" },
      { dk: "prøvesagkyndig", en: "Driving examiner", ru: "экзаменатор", topic: "docs" },
      { dk: "registreringsattest", en: "Vehicle registration certificate", ru: "свидетельство о регистрации ТС", topic: "docs" },
      { dk: "strafbart", en: "Illegal", ru: "наказуемое деяние", topic: "docs" },
      { dk: "ubetinget frakendelse af kørekort", en: "Revoked driver's license", ru: "безусловное лишение прав", topic: "docs" },
      { dk: "udåndingsprøve", en: "Breathalyzer test", ru: "тест на алкоголь (выдыхание)", topic: "docs" },
      { dk: "promille", en: "Blood alcohol concentration", ru: "промилле, концентрация алкоголя в крови", topic: "docs" },
      { dk: "spirituskørsel", en: "Driving under the influence (DUI)", ru: "вождение в нетрезвом виде", topic: "docs" },
      { dk: "forbrænding af alkohol", en: "Rate at which the body metabolises alcohol", ru: "скорость вывода алкоголя из организма", topic: "docs" },
      { dk: "forhold", en: "Conditions", ru: "условия (дорожные)", topic: "docs" },
      { dk: "pause", en: "Break", ru: "перерыв, пауза", topic: "docs" },
      { dk: "reaktionstid", en: "Reaction time", ru: "время реакции", topic: "docs" },

      // SAFETY & EMERGENCY
      { dk: "alarmcentral", en: "Emergency services", ru: "служба экстренного вызова (112)", topic: "safety" },
      { dk: "fare", en: "Danger", ru: "опасность", topic: "safety" },
      { dk: "farligt vejsving", en: "Dangerous bend in the road", ru: "опасный поворот", topic: "safety" },
      { dk: "hindring", en: "Obstacles", ru: "препятствия", topic: "safety" },
      { dk: "nedsat vejgreb", en: "Reduced traction", ru: "пониженное сцепление с дорогой", topic: "safety" },
      { dk: "sideafstand", en: "Distance to the side / Side distance", ru: "боковой интервал", topic: "safety" },
      { dk: "sidevind", en: "Crosswind", ru: "боковой ветер", topic: "safety" },
      { dk: "sikkerhedsafstand", en: "Safety distance", ru: "безопасная дистанция", topic: "safety" },
      { dk: "standselængde", en: "Stopping distance", ru: "остановочный путь", topic: "safety" },
      { dk: "ude af drift", en: "Out of order", ru: "не работает, не в эксплуатации", topic: "safety" },
      { dk: "udrykningskøretøj", en: "Emergency vehicle", ru: "автомобиль экстренных служб", topic: "safety" },
      { dk: "ulempe", en: "Inconvenience", ru: "помеха, неудобство", topic: "safety" },
      { dk: "unødig ulempe", en: "Unnecessary inconvenience", ru: "необоснованная помеха", topic: "safety" },
      { dk: "uvirksom", en: "Ineffective", ru: "недействующий, неэффективный", topic: "safety" },
      { dk: "vejens tilstand", en: "Road condition", ru: "состояние дорожного покрытия", topic: "safety" },
      { dk: "vejgreb", en: "Road grip / Traction", ru: "сцепление с дорогой", topic: "safety" },
      { dk: "væltning", en: "Overturning", ru: "опрокидывание", topic: "safety" },
      { dk: "være til fare", en: "Cause danger for…", ru: "представлять опасность для…", topic: "safety" },
      { dk: "defekt", en: "Faulty", ru: "неисправный", topic: "safety" },
      { dk: "bagudrettede", en: "Rear-facing", ru: "обращённый назад (напр. детское кресло)", topic: "safety" },
      { dk: "bagudvendende", en: "Rear-facing", ru: "повёрнутый назад", topic: "safety" }
    ]
  },

  "motorcycle": {
    "title": "Motorcykel",
    "title_en": "Motorcycle",
    "title_ru": "Мотоцикл",
    "icon": "🏍️",
    "items": [
      { dk: "bremsegreb", en: "Brake lever", ru: "тормозная рукоятка", topic: null },
      { dk: "bremsekabler", en: "Brake cables", ru: "тормозные тросы", topic: null },
      { dk: "bremsepedal", en: "Brake pedal", ru: "педаль тормоза", topic: null },
      { dk: "eger", en: "Spokes", ru: "спицы", topic: null },
      { dk: "gaffelkrone / samlestykke", en: "Triple clamp", ru: "траверса вилки", topic: null },
      { dk: "håndtag", en: "Handles", ru: "ручки руля", topic: null },
      { dk: "kronrør / styrestamme", en: "Central column", ru: "рулевая колонка мотоцикла", topic: null },
      { dk: "kæde", en: "Chain", ru: "цепь", topic: null },
      { dk: "skridsikker overflade", en: "Non-slip surface", ru: "противоскользящая поверхность", topic: null },
      { dk: "styrudslag", en: "Handlebar clearance", ru: "угол поворота руля", topic: null },
      { dk: "teleskoprør", en: "Telescopic tube", ru: "телескопическая стойка вилки", topic: null }
    ]
  },

  "trailer": {
    "title": "Påhæng",
    "title_en": "Trailer",
    "title_ru": "Прицеп",
    "icon": "🚐",
    "items": [
      { dk: "busvogntog", en: "Bus and trailer", ru: "автобус с прицепом", topic: null },
      { dk: "campingvogn", en: "Caravan", ru: "жилой прицеп, караван", topic: null },
      { dk: "drejekrans", en: "Turntable", ru: "поворотный круг (сцепной)", topic: null },
      { dk: "fast kombination", en: "Fixed combination", ru: "постоянная сцепка", topic: null },
      { dk: "forskydelig sættevognsskammel", en: "Sliding fifth wheel hitch", ru: "подвижное седло полуприцепа", topic: null },
      { dk: "forskydelig trækstang", en: "Extendible drawbar", ru: "выдвижное дышло", topic: null },
      { dk: "hovedbolttryk", en: "Kingpin load", ru: "нагрузка на шкворень", topic: null },
      { dk: "koblingsattest", en: "Coupling certificate", ru: "сертификат сцепки", topic: null },
      { dk: "koblingslængde", en: "Coupling length", ru: "длина сцепки", topic: null },
      { dk: "kærre", en: "Centre-axle trailer", ru: "одноосный прицеп", topic: null },
      { dk: "presenning", en: "Tarpaulin", ru: "тент", topic: null },
      { dk: "påhængskøretøj", en: "Trailer", ru: "прицепное транспортное средство", topic: null },
      { dk: "påhængsvogn", en: "Trailer", ru: "прицеп", topic: null },
      { dk: "påløbsbremse", en: "Overrun brake", ru: "инерционный (наездной) тормоз", topic: null },
      { dk: "rokkeprøve", en: "Tug test", ru: "проверка на раскачивание (сцепки)", topic: null },
      { dk: "sammenkobling", en: "Hook up", ru: "сцепка, соединение", topic: null },
      { dk: "sikkerhedskæde", en: "Safety chain / wire", ru: "страховочная цепь / трос", topic: null },
      { dk: "stødstang", en: "Compressible drawbar", ru: "сжимаемое дышло", topic: null },
      { dk: "synsfri sammenkobling", en: "Non-inspected combination", ru: "сцепка без техосмотра (упрощённая)", topic: null },
      { dk: "sættevogn", en: "Semi-trailer", ru: "полуприцеп", topic: null },
      { dk: "tilkoblingsanordning", en: "Trailer hitch / Tow hitch / Coupling device", ru: "тягово-сцепное устройство, фаркоп", topic: null },
      { dk: "traktorvogntog", en: "Tractor and trailer", ru: "трактор с прицепом", topic: null },
      { dk: "variable kombination", en: "Variable combination", ru: "переменная сцепка", topic: null }
    ]
  },

  "heavy": {
    "title": "Storvogn",
    "title_en": "Heavy Vehicle",
    "title_ru": "Грузовой транспорт",
    "icon": "🚛",
    "items": [
      { dk: "ALB-ventil", en: "ALB valve (Load sensing valve)", ru: "регулятор тормозных сил (ALB-клапан)", topic: null },
      { dk: "bagsmækken", en: "Rear tailgate", ru: "задний борт", topic: null },
      { dk: "bakspærre-anordning", en: "Reverse-blocking device", ru: "блокировка заднего хода", topic: null },
      { dk: "belæsningen (vægtfordeling)", en: "Load (Load distribution)", ru: "загрузка (распределение веса)", topic: null },
      { dk: "blindvinkelspejl", en: "Blind spot mirror", ru: "зеркало мёртвой зоны", topic: null },
      { dk: "bogietryk", en: "Bogie axle load", ru: "нагрузка на тележку (двойную ось)", topic: null },
      { dk: "boltforbindelse", en: "Bolt connection", ru: "болтовое соединение", topic: null },
      { dk: "bremsekraftregulator", en: "ALB valve (Load sensing valve)", ru: "регулятор тормозных усилий", topic: null },
      { dk: "bremsemembrane", en: "Brake chamber", ru: "тормозная камера", topic: null },
      { dk: "certifikat for særlig uddannelse", en: "Certificate of special training", ru: "сертификат спецподготовки", topic: null },
      { dk: "chaufføruddannelsesbevis", en: "Driver educational certificate", ru: "удостоверение о профобучении водителя (CPC)", topic: null },
      { dk: "containerlad", en: "Container flatbed", ru: "контейнеровоз (платформа)", topic: null },
      { dk: "containerlås", en: "Container lock", ru: "замок-фитинг для контейнера", topic: null },
      { dk: "diagramark", en: "Record sheet", ru: "тахографический диск", topic: null },
      { dk: "dobbeltdækkerbus", en: "Double-decker bus", ru: "двухэтажный автобус", topic: null },
      { dk: "erhvervsmæssig godstransport", en: "Commercial transport of goods", ru: "коммерческие грузоперевозки", topic: null },
      { dk: "erhvervsmæssig personbefordring", en: "Commercial passenger transport", ru: "коммерческие пассажироперевозки", topic: null },
      { dk: "fast lad", en: "Fixed flatbed", ru: "стационарная грузовая платформа", topic: null },
      { dk: "fjederbremser", en: "Spring brakes", ru: "пружинные энергоаккумуляторы (тормоза)", topic: null },
      { dk: "forsmæk", en: "Front headboard", ru: "передний борт", topic: null },
      { dk: "frontspejl", en: "Front mirror", ru: "переднее зеркало", topic: null },
      { dk: "funktionstid", en: "Brake lag", ru: "время срабатывания тормоза", topic: null },
      { dk: "hejseanordning", en: "Hoisting device", ru: "подъёмное устройство", topic: null },
      { dk: "hjælpebremse", en: "Auxiliary brake", ru: "вспомогательный (запасной) тормоз", topic: null },
      { dk: "kompressor", en: "Compressor", ru: "компрессор", topic: null },
      { dk: "kontrolapparat (fartskriveren)", en: "Control device (tachograph)", ru: "тахограф", topic: null },
      { dk: "kølekasse", en: "Refrigerated box", ru: "рефрижераторный кузов", topic: null },
      { dk: "kølevogn", en: "Refrigerated truck", ru: "рефрижератор (грузовик)", topic: null },
      { dk: "køre- hviletid", en: "Driving and rest time", ru: "режим труда и отдыха водителя", topic: null },
      { dk: "lastbil / forvogn", en: "Truck / Rigid truck", ru: "грузовик / тягач", topic: null },
      { dk: "lastbilmonteret kran", en: "Truck-mounted crane", ru: "автокран, манипулятор", topic: null },
      { dk: "luftfjederbælg", en: "Air spring bellows / Air suspension", ru: "пневмоподушка / пневмоподвеска", topic: null },
      { dk: "lufttørreanlægget", en: "Air dryer system", ru: "осушитель воздуха", topic: null },
      { dk: "læssebagsmæk", en: "Tail lift", ru: "гидроборт", topic: null },
      { dk: "læssekran", en: "Loading crane", ru: "погрузочный кран", topic: null },
      { dk: "markeringslygte", en: "Outline marker light", ru: "габаритный фонарь (контурный)", topic: null },
      { dk: "mekanisk sikring", en: "Mechanical safety device", ru: "механическая страховка", topic: null },
      { dk: "nærzonespejl", en: "Close proximity mirror", ru: "зеркало ближней зоны", topic: null },
      { dk: "nødudgangsdør", en: "Emergency exit door", ru: "аварийная дверь", topic: null },
      { dk: "overvågning", en: "Monitor", ru: "контроль, наблюдение", topic: null },
      { dk: "presenning", en: "Tarpaulin", ru: "тент", topic: null },
      { dk: "påskrift", en: "Decal", ru: "наклейка, маркировка", topic: null },
      { dk: "reaktionstid", en: "Reaction time", ru: "время реакции", topic: null },
      { dk: "refleksplanke", en: "Reflective plate", ru: "светоотражающая планка", topic: null },
      { dk: "relæventil", en: "Relay valve", ru: "ускорительный клапан", topic: null },
      { dk: "sideafskærmning", en: "Side guard rails", ru: "боковая защита (от подкатывания)", topic: null },
      { dk: "sidemarkeringslygte", en: "Side marker light", ru: "боковой габаритный фонарь", topic: null },
      { dk: "skiftelad", en: "Swap body", ru: "съёмный кузов", topic: null },
      { dk: "soveplads", en: "Sleeping cab", ru: "спальное место в кабине", topic: null },
      { dk: "stempelvandring", en: "Stroke length / Piston travel", ru: "ход штока (тормозной камеры)", topic: null },
      { dk: "surringsreb", en: "Lashing belt", ru: "крепёжный ремень", topic: null },
      { dk: "sættelad", en: "Detachable bed", ru: "съёмная платформа", topic: null },
      { dk: "tankvogn", en: "Tanker truck or trailer", ru: "автоцистерна / прицеп-цистерна", topic: null },
      { dk: "termorude", en: "Double-glazed windows", ru: "двойное (термо) остекление", topic: null },
      { dk: "tilstoppet luftfilter", en: "Clogged air filter for the compressor", ru: "забитый воздушный фильтр компрессора", topic: null },
      { dk: "tippelad", en: "Dump bed", ru: "самосвальный кузов", topic: null },
      { dk: "trykluft kontrollys", en: "Air pressure warning light", ru: "контрольная лампа давления воздуха", topic: null },
      { dk: "trykluft-hydraulisk transformer", en: "Compressed air hydraulic transformer", ru: "пневмогидравлический преобразователь", topic: null },
      { dk: "trykluftstank", en: "Compressed air tank", ru: "ресивер сжатого воздуха", topic: null },
      { dk: "trykregulator", en: "Governor", ru: "регулятор давления", topic: null },
      { dk: "tryksikringsventil (4-kredsventil)", en: "Double check valve (4-circuit)", ru: "защитный клапан (4-контурный)", topic: null },
      { dk: "trækkende lastbil (sættevognstog)", en: "Towing truck / Tractor unit", ru: "седельный тягач", topic: null },
      { dk: "udstigningsdør", en: "Exit door", ru: "дверь для выхода (пассажиров)", topic: null },
      { dk: "underkøringsafskærmning", en: "Underride guard", ru: "противоподкатная защита", topic: null },
      { dk: "veksellad", en: "Swap body", ru: "сменный кузов", topic: null },
      { dk: "vidvinkelsspejl", en: "Wide angle mirror", ru: "широкоугольное зеркало", topic: null }
    ]
  }
};

// Stable IDs for each term — used for storing progress in localStorage
function termId(item) {
  return item.dk.replace(/[^a-zA-Z0-9æøåÆØÅ]/g, '').toLowerCase();
}

// Add stable IDs
Object.values(DICTIONARY).forEach(cat => {
  cat.items.forEach(item => {
    item.id = termId(item);
  });
});

const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const escHtml = (s) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  /* ============== STATE & STORAGE ============== */
  const STORAGE_KEY = 'wex-exam-words-2026-progress-v1';
  const SETTINGS_KEY = 'wex-exam-words-2026-settings-v1';

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch(e) { return {}; }
  }
  function saveProgress() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress)); } catch(e) {}
  }
  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch(e) { return {}; }
  }
  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings)); } catch(e) {}
  }

  const state = {
    activeCat: 'all',
    activeStatus: 'all',
    query: '',
    mode: 'list',
    flashIdx: 0,
    flashList: [],
    flashFlipped: false,
    progress: loadProgress(), // { termId: 'known' | 'hard' }
    settings: loadSettings(),
    quiz: {
      direction: 'en-to-ru',
      list: [],
      idx: 0,
      currentItem: null,
      options: [],
      correctIdx: 0,
      answered: false,
      score: { correct: 0, wrong: 0, streak: 0, total: 0 }
    },
    danishVoice: null,
  };

  // Apply saved settings
  if (state.settings.collapsedSubtopics === undefined) state.settings.collapsedSubtopics = {};

  /* ============== ALL TERMS FLAT ============== */
  const ALL_TERMS = [];
  Object.entries(DICTIONARY).forEach(([catKey, cat]) => {
    cat.items.forEach(item => {
      ALL_TERMS.push({ ...item, catKey });
    });
  });

  /* ============== STATUS HELPERS ============== */
  function getStatus(item) {
    return state.progress[item.id] || 'untouched';
  }

  function setStatus(item, status) {
    if (status === 'untouched') {
      delete state.progress[item.id];
    } else {
      state.progress[item.id] = status;
    }
    saveProgress();
    updateStats();
  }

  function toggleStatus(item, target) {
    const current = getStatus(item);
    if (current === target) {
      setStatus(item, 'untouched');
    } else {
      setStatus(item, target);
    }
  }

  function countByStatus() {
    let known = 0, hard = 0, untouched = 0;
    ALL_TERMS.forEach(item => {
      const s = getStatus(item);
      if (s === 'known') known++;
      else if (s === 'hard') hard++;
      else untouched++;
    });
    return { known, hard, untouched, total: ALL_TERMS.length };
  }

  /* ============== STATS ============== */
  function updateStats() {
    const c = countByStatus();
    $('#meta-total').textContent = c.total;
    $('#meta-known').textContent = c.known;
    $('#meta-hard').textContent = c.hard;
    $('#meta-cats').textContent = Object.keys(DICTIONARY).length;

    const knownPct = (c.known / c.total) * 100;
    const hardPct = (c.hard / c.total) * 100;
    $('#bar-known').style.width = knownPct + '%';
    $('#bar-hard').style.width = hardPct + '%';
    $('#bar-known-pct').textContent = Math.round(knownPct) + '%';
    $('#bar-hard-pct').textContent = Math.round(hardPct) + '%';
    $('#bar-untouched').textContent = c.untouched;

    $('#count-all').textContent = c.total;
    $('#count-known').textContent = c.known;
    $('#count-hard').textContent = c.hard;
    $('#count-untouched').textContent = c.untouched;
  }

  /* ============== TEXT-TO-SPEECH (rewritten) ============== */
  state.tts = {
    supported: 'speechSynthesis' in window,
    primed: false,
    voicesLoaded: false,
    allVoices: [],
    selectedVoiceURI: null,    // user's chosen voice (persisted)
    danishVoice: null,
    fallbackVoice: null,
    lastError: null,
    userTriedSpeak: false,
    pollAttempts: 0,
  };

  // Load saved voice preference
  try {
    state.tts.selectedVoiceURI = localStorage.getItem('wex-exam-words-2026-tts-voice') || null;
  } catch(e) {}

  function saveVoicePref(uri) {
    try { localStorage.setItem('wex-exam-words-2026-tts-voice', uri || ''); } catch(e) {}
    state.tts.selectedVoiceURI = uri;
  }

  function loadVoices() {
    if (!state.tts.supported) return;
    const voices = speechSynthesis.getVoices();
    if (voices.length === 0) return;
    state.tts.allVoices = voices;
    state.tts.voicesLoaded = true;

    // Detect Danish voice
    const isDanish = (v) => {
      const lang = (v.lang || '').toLowerCase().replace('_', '-');
      const name = (v.name || '').toLowerCase();
      return lang === 'da-dk' || lang.startsWith('da-') || lang === 'da'
          || name.includes('danish') || name.includes('dansk');
    };

    state.tts.danishVoice = voices.find(isDanish) || null;
    state.tts.fallbackVoice =
         voices.find(v => (v.lang || '').toLowerCase().startsWith('en'))
      || voices.find(v => v.default)
      || voices[0]
      || null;
  }

  function primeTts() {
    if (state.tts.primed || !state.tts.supported) return;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      u.rate = 1;
      speechSynthesis.speak(u);
      state.tts.primed = true;
    } catch(e) {}
  }

  function getPreferredVoice(lang = 'en') {
    if (!state.tts.allVoices.length) return null;

    const wantDanish = lang === 'da';
    const wantEnglish = lang === 'en';

    // 1. user's explicit choice (only respect if matches requested language family)
    if (state.tts.selectedVoiceURI) {
      const v = state.tts.allVoices.find(x => x.voiceURI === state.tts.selectedVoiceURI);
      if (v) {
        const vLang = (v.lang || '').toLowerCase();
        if (wantDanish && vLang.startsWith('da')) return v;
        if (wantEnglish && vLang.startsWith('en')) return v;
        // If user picked a voice but it doesn't match the requested language, fall through
      }
    }

    // 2. find by language family
    if (wantDanish) {
      const danish = state.tts.allVoices.find(v => {
        const vLang = (v.lang || '').toLowerCase();
        const vName = (v.name || '').toLowerCase();
        return vLang.startsWith('da') || vName.includes('danish') || vName.includes('dansk');
      });
      if (danish) return danish;
    }
    if (wantEnglish) {
      // Prefer en-US, then en-GB, then any en-*
      const enUS = state.tts.allVoices.find(v => (v.lang || '').toLowerCase() === 'en-us');
      if (enUS) return enUS;
      const enGB = state.tts.allVoices.find(v => (v.lang || '').toLowerCase() === 'en-gb');
      if (enGB) return enGB;
      const anyEn = state.tts.allVoices.find(v => (v.lang || '').toLowerCase().startsWith('en'));
      if (anyEn) return anyEn;
    }

    // 3. fallback
    return state.tts.fallbackVoice;
  }

  function speak(text, btn, voice = null, lang = 'en') {
    if (!state.tts.supported) {
      openTtsDialog();
      return;
    }

    state.tts.userTriedSpeak = true;
    primeTts();
    if (!state.tts.voicesLoaded) loadVoices();

    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = voice || getPreferredVoice(lang);

      if (v) {
        u.voice = v;
        u.lang = v.lang || (lang === 'da' ? 'da-DK' : 'en-US');
      } else {
        u.lang = lang === 'da' ? 'da-DK' : 'en-US';
      }

      u.rate = 0.9;
      u.pitch = 1.0;
      u.volume = 1.0;

      if (btn) {
        btn.classList.add('speaking');
        const cleanup = () => btn.classList.remove('speaking');
        u.onend = cleanup;
        u.onerror = (ev) => {
          cleanup();
          state.tts.lastError = ev.error || 'unknown';
        };
      }

      speechSynthesis.speak(u);
      state.tts.lastError = null;
    } catch(err) {
      state.tts.lastError = err.message;
    }
  }

  // Convenience wrappers
  function speakEnglish(text, btn) { speak(text, btn, null, 'en'); }
  function speakDanish(text, btn) { speak(text, btn, null, 'da'); }

  /* ============ TTS DIALOG ============ */
  function openTtsDialog() {
    state.tts.userTriedSpeak = true;
    if (!state.tts.voicesLoaded) loadVoices();

    const dialog = $('#tts-dialog');
    const list = $('#tts-voice-list');
    const status = $('#tts-status');

    if (!state.tts.supported) {
      status.innerHTML = '<span class="bad">⚠</span> Your browser does not support text-to-speech.';
      list.innerHTML = '<div class="tts-empty">Try a different browser (Chrome, Edge, Safari).</div>';
      dialog.classList.add('open');
      return;
    }

    const voices = state.tts.allVoices;
    if (voices.length === 0) {
      status.innerHTML = '<span class="warn">…</span> Loading voices… try again in a moment.';
      list.innerHTML = '';
      dialog.classList.add('open');
      // Retry shortly
      setTimeout(() => {
        loadVoices();
        if (state.tts.allVoices.length > 0 && dialog.classList.contains('open')) {
          openTtsDialog();
        }
      }, 500);
      return;
    }

    // Group voices: English first (user learns in English), Danish second, then others
    const englishVoices = voices.filter(v => (v.lang || '').toLowerCase().startsWith('en'));
    const danishVoices = voices.filter(v => {
      const lang = (v.lang || '').toLowerCase();
      return lang.startsWith('da') || (v.name || '').toLowerCase().includes('danish');
    });

    const otherVoices = voices.filter(v => !englishVoices.includes(v) && !danishVoices.includes(v));
    otherVoices.sort((a, b) => (a.lang || '').localeCompare(b.lang || ''));

    if (danishVoices.length === 0) {
      // User is learning in English — Danish absence is fine
      status.innerHTML = `<span class="good">✓</span> Pick a voice for the audio button. ${voices.filter(v => (v.lang || '').toLowerCase().startsWith('en')).length} English voice${voices.filter(v => (v.lang || '').toLowerCase().startsWith('en')).length !== 1 ? 's' : ''} available.`;
    } else {
      status.innerHTML = `<span class="good">✓</span> ${danishVoices.length} Danish voice${danishVoices.length > 1 ? 's' : ''} found, plus other languages.`;
    }

    const renderVoiceItem = (v, langLabel) => {
      const sel = state.tts.selectedVoiceURI === v.voiceURI;
      return `
        <button class="tts-voice ${sel ? 'selected' : ''}" data-voice-uri="${escHtml(v.voiceURI)}">
          <div class="tts-voice-name">
            <span class="tts-name">${escHtml(v.name)}</span>
            ${sel ? '<span class="tts-current">selected</span>' : ''}
          </div>
          <div class="tts-voice-meta">${langLabel}${v.localService ? ' · local' : ' · network'}</div>
          <button class="tts-voice-test" data-test-uri="${escHtml(v.voiceURI)}" title="Test this voice">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          </button>
        </button>
      `;
    };

    let html = '';
    if (englishVoices.length > 0) {
      html += '<div class="tts-section-title">English voices (recommended)</div>';
      html += englishVoices.map(v => renderVoiceItem(v, '🇬🇧 ' + (v.lang || 'en'))).join('');
    }
    if (danishVoices.length > 0) {
      html += '<div class="tts-section-title">Danish voices</div>';
      html += danishVoices.map(v => renderVoiceItem(v, '🇩🇰 Danish')).join('');
    }
    if (otherVoices.length > 0) {
      html += `<div class="tts-section-title">Other voices (${otherVoices.length})</div>`;
      html += otherVoices.slice(0, 30).map(v => renderVoiceItem(v, v.lang || '?')).join('');
      if (otherVoices.length > 30) {
        html += `<div class="tts-empty">${otherVoices.length - 30} more not shown</div>`;
      }
    }

    list.innerHTML = html;
    dialog.classList.add('open');
  }

  function closeTtsDialog() { $('#tts-dialog').classList.remove('open'); }

  function showTtsHelp() {
    const ua = navigator.userAgent;
    let instructions;
    if (/iPhone|iPad|iPod/.test(ua)) {
      instructions = 'iOS: Settings → Accessibility → Spoken Content → Voices → Danish → choose a voice. Then restart the browser.';
    } else if (/Android/.test(ua)) {
      instructions = 'Android: Settings → System → Languages & input → Text-to-speech → Install voice data → Danish.';
    } else if (/Mac/.test(ua)) {
      instructions = 'macOS: System Settings → Accessibility → Spoken Content → System Voice → Manage Voices → enable Danish (Sara, Magnus).';
    } else if (/Windows/.test(ua)) {
      instructions = 'Windows: Settings → Time & Language → Speech → Manage voices → Add → Danish (Christel, Jeppe).';
    } else {
      instructions = 'Install a Danish voice in your operating system settings.';
    }
    alert('Add Danish voice\n\n' + instructions);
  }

  /* ============== HIGHLIGHT ============== */
  /* ============== SMART SEARCH ============== */
  // Russian ↔ Latin transliteration (helps when user types "tormoz" and means "тормоз")
  const RU_TO_LAT = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z',
    'и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r',
    'с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh',
    'щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'
  };
  const LAT_TO_RU = (() => {
    const m = {};
    // Multi-char digraphs first (longest first matters in transliteration)
    const pairs = [
      ['sch','щ'],['shch','щ'],['zh','ж'],['ch','ч'],['sh','ш'],['ts','ц'],
      ['yu','ю'],['ya','я'],['yo','ё'],['kh','х'],['eh','э']
    ];
    return { single: { 'a':'а','b':'б','v':'в','g':'г','d':'д','e':'е','z':'з',
      'i':'и','y':'й','k':'к','l':'л','m':'м','n':'н','o':'о','p':'п','r':'р',
      's':'с','t':'т','u':'у','f':'ф','h':'х','c':'к','x':'кс','j':'й','q':'к','w':'в' },
      digraphs: pairs };
  })();

  function transliterateRu(str) {
    return str.toLowerCase().split('').map(ch => RU_TO_LAT[ch] !== undefined ? RU_TO_LAT[ch] : ch).join('');
  }

  function transliterateLat(str) {
    let s = str.toLowerCase();
    // First digraphs
    for (const [lat, ru] of LAT_TO_RU.digraphs) {
      s = s.split(lat).join(ru);
    }
    // Then single letters
    return s.split('').map(ch => LAT_TO_RU.single[ch] !== undefined ? LAT_TO_RU.single[ch] : ch).join('');
  }

  // Normalize for comparison: lowercase, strip diacritics, collapse spaces
  const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

  // Detect script of a string (cyrillic vs latin) for smart transliteration
  function detectScript(s) {
    if (/[\u0400-\u04FF]/.test(s)) return 'cyrillic';
    if (/[a-zA-Z]/.test(s)) return 'latin';
    return 'other';
  }

  // Levenshtein distance — capped early for efficiency
  function levenshtein(a, b, max = 3) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > max) return max + 1;
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;

    let prev = new Array(n + 1);
    let curr = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;

    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      let rowMin = i;
      for (let j = 1; j <= n; j++) {
        const cost = a[i-1] === b[j-1] ? 0 : 1;
        curr[j] = Math.min(
          curr[j-1] + 1,
          prev[j] + 1,
          prev[j-1] + cost
        );
        if (curr[j] < rowMin) rowMin = curr[j];
      }
      if (rowMin > max) return max + 1; // early exit
      [prev, curr] = [curr, prev];
    }
    return prev[n];
  }

  // Score how well a single token matches inside a haystack string.
  // Higher = better. 0 = no match.
  function scoreToken(haystack, token) {
    if (!token) return 0;
    const h = haystack;
    const t = token;

    // Exact whole-string match
    if (h === t) return 1000;

    // Starts with token (prefix)
    if (h.startsWith(t)) return 800 - (h.length - t.length);

    // Word in string starts with token (e.g. "brake" in "brake discs")
    const words = h.split(/\s|\/|-/);
    for (const w of words) {
      if (w === t) return 700;
      if (w.startsWith(t)) return 600;
    }

    // Substring match (anywhere)
    const idx = h.indexOf(t);
    if (idx !== -1) return 400 - idx; // earlier match scores higher

    // Fuzzy: only allow if token is at least 4 chars to avoid noise
    if (t.length >= 4) {
      // Check fuzzy match against each word
      let bestFuzzy = 0;
      // Slightly more permissive: 4-5 chars → up to 2; 6+ → up to 2; very long → 3
      const maxDist = t.length <= 5 ? 2 : (t.length <= 9 ? 2 : 3);
      for (const w of words) {
        if (Math.abs(w.length - t.length) > maxDist) continue;
        const d = levenshtein(w, t, maxDist);
        if (d <= maxDist) {
          // closer match = higher score
          const fuzzyScore = 200 - d * 30;
          if (fuzzyScore > bestFuzzy) bestFuzzy = fuzzyScore;
        }
      }
      if (bestFuzzy > 0) return bestFuzzy;

      // Also try fuzzy on the whole haystack for short haystacks
      if (h.length - t.length <= maxDist + 2) {
        const d = levenshtein(h.slice(0, t.length + maxDist), t, maxDist);
        if (d <= maxDist) return 150 - d * 30;
      }
    }

    return 0;
  }

  // Score an item against the full multi-word query.
  // Returns combined score across EN/DK/RU and across all query tokens.
  function scoreItem(item, queryTokens) {
    if (queryTokens.length === 0) return 1; // no query — keep all

    const en = norm(item.en);
    const dk = norm(item.dk);
    const ru = norm(item.ru);
    const ruTransliterated = transliterateRu(ru); // for "tormoz" → "тормоз" matches

    let totalScore = 0;
    for (const token of queryTokens) {
      // Try original token across all 3 fields
      let bestForToken = Math.max(
        scoreToken(en, token) * 1.2,    // English boosted (primary lang)
        scoreToken(ru, token) * 1.0,
        scoreToken(dk, token) * 0.7,    // Danish a bit lower
        scoreToken(ruTransliterated, token) * 0.9  // RU transliterated for latin queries
      );

      // If the token is in latin but might be intended cyrillic, try transliterating it
      if (bestForToken === 0 && /^[a-z]+$/.test(token)) {
        const cyrillicToken = transliterateLat(token);
        if (cyrillicToken !== token) {
          bestForToken = scoreToken(ru, cyrillicToken) * 0.85;
        }
      }

      // Each token must match SOMETHING for the item to qualify
      if (bestForToken === 0) return 0;
      totalScore += bestForToken;
    }
    return totalScore;
  }

  // Tokenize query: split on whitespace, lowercase, normalize
  function tokenizeQuery(q) {
    return norm(q).split(/\s+/).filter(Boolean);
  }

  // Smart highlight: marks each query token wherever it appears (substring or fuzzy)
  function highlight(text, q) {
    if (!q) return escHtml(text);
    const tokens = tokenizeQuery(q);
    if (tokens.length === 0) return escHtml(text);

    const nText = norm(text);
    // Find all match ranges
    const ranges = [];
    for (const tok of tokens) {
      let searchFrom = 0;
      while (true) {
        const idx = nText.indexOf(tok, searchFrom);
        if (idx === -1) break;
        ranges.push([idx, idx + tok.length]);
        searchFrom = idx + 1;
      }
      // If no exact substring, try transliteration (latin query against cyrillic text)
      if (!ranges.some(r => nText.slice(r[0], r[1]) === tok) && /^[a-z]+$/.test(tok)) {
        const cyr = transliterateLat(tok);
        if (cyr !== tok) {
          let from = 0;
          while (true) {
            const idx = nText.indexOf(cyr, from);
            if (idx === -1) break;
            ranges.push([idx, idx + cyr.length]);
            from = idx + 1;
          }
        }
      }
    }

    if (ranges.length === 0) return escHtml(text);

    // Sort and merge overlapping ranges
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [ranges[0]];
    for (let i = 1; i < ranges.length; i++) {
      const last = merged[merged.length - 1];
      if (ranges[i][0] <= last[1]) {
        last[1] = Math.max(last[1], ranges[i][1]);
      } else {
        merged.push(ranges[i]);
      }
    }

    // Build highlighted output
    let result = '';
    let pos = 0;
    for (const [start, end] of merged) {
      if (start > pos) result += escHtml(text.slice(pos, start));
      result += '<mark>' + escHtml(text.slice(start, end)) + '</mark>';
      pos = end;
    }
    if (pos < text.length) result += escHtml(text.slice(pos));
    return result;
  }

  /* ============== RENDER LIST ============== */
  function filterItem(item) {
    if (state.activeStatus !== 'all') {
      const s = getStatus(item);
      if (state.activeStatus === 'untouched' && s !== 'untouched') return false;
      if (state.activeStatus === 'known' && s !== 'known') return false;
      if (state.activeStatus === 'hard' && s !== 'hard') return false;
    }
    return true;
  }

  function renderQuickNav() {
    const nav = $('#quick-nav');
    nav.innerHTML = Object.entries(DICTIONARY).map(([key, cat]) => `
      <a href="#cat-${key}" class="nav-pill" data-jump="${key}">
        <span>${cat.title_en}</span>
        <span class="count">${cat.items.length}</span>
      </a>
    `).join('');
  }

  function itemHtml(item, q, catLabel) {
    const status = getStatus(item);
    const statusBadge = status === 'known' ? '<span class="badge known">✓ Known</span>'
                : status === 'hard' ? '<span class="badge hard">! Difficult</span>'
                : '';
    const catBadge = catLabel ? `<span class="badge cat">${escHtml(catLabel)}</span>` : '';
    const knownClass = status === 'known' ? 'is-known' : '';
    return `
      <div class="item ${knownClass}" data-term-id="${item.id}">
        <div class="item-content">
          <div class="item-en-row">
            <div class="item-en">${highlight(item.en, q)}</div>
            <button class="speak-inline" data-action="speak" data-text="${escHtml(item.en)}" data-lang="en" title="Speak English" aria-label="Speak English">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
            </button>
            ${statusBadge}${catBadge}
          </div>
          <div class="item-ru">${highlight(item.ru, q)}</div>
          <div class="item-dk">
            <span>${highlight(item.dk, q)}</span>
          </div>
        </div>
        <div class="item-actions">
          <button class="action-btn ${status === 'known' ? 'active known' : ''}" data-action="known" data-term-id="${item.id}" title="Mark as known">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          </button>
          <button class="action-btn ${status === 'hard' ? 'active hard' : ''}" data-action="hard" data-term-id="${item.id}" title="Mark as difficult">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17h.01"/><path d="M12 13v-2"/><circle cx="12" cy="12" r="10"/></svg>
          </button>
        </div>
      </div>
    `;
  }

  function renderCategories() {
    const root = $('#categories');
    const q = state.query.trim();
    const queryTokens = tokenizeQuery(q);
    const isSearching = queryTokens.length > 0;
    let visibleCount = 0;

    // ============ SEARCH MODE: flat sorted-by-relevance list ============
    if (isSearching) {
      const candidates = [];
      Object.entries(DICTIONARY).forEach(([key, cat]) => {
        if (state.activeCat !== 'all' && state.activeCat !== key) return;
        cat.items.forEach(item => {
          if (!filterItem(item)) return;
          const score = scoreItem(item, queryTokens);
          if (score > 0) candidates.push({ item, score, catKey: key, cat });
        });
      });

      // Sort by score descending; tie-break by alphabetical
      candidates.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.item.en.localeCompare(b.item.en);
      });

      visibleCount = candidates.length;

      if (candidates.length === 0) {
        root.innerHTML = '';
        $('#empty').style.display = 'block';
        return;
      }

      // Render single section "Search results"
      const itemsHtml = candidates.map(c => itemHtml(c.item, q, c.cat.title_en)).join('');
      root.innerHTML = `
        <section class="category">
          <div class="category-header">
            <div class="category-eyebrow">Search results</div>
            <div class="category-title-block">
              <div class="category-titles">
                <h2>${candidates.length} ${candidates.length === 1 ? 'match' : 'matches'} for "${escHtml(q)}"</h2>
                <div class="category-meta">Sorted by relevance</div>
              </div>
              <div class="category-count">${candidates.length}</div>
            </div>
          </div>
          <div class="items">${itemsHtml}</div>
        </section>
      `;
      $('#empty').style.display = 'none';
      return;
    }

    // ============ BROWSE MODE: categories + subtopics, alphabetical ============
    root.innerHTML = Object.entries(DICTIONARY).map(([key, cat]) => {
      if (state.activeCat !== 'all' && state.activeCat !== key) return '';

      const matched = cat.items.filter(filterItem);
      if (matched.length === 0) return '';
      visibleCount += matched.length;

      let bodyHtml;
      if (key === 'general' && matched.some(i => i.topic)) {
        const groups = {};
        matched.forEach(item => {
          const t = item.topic || 'misc';
          if (!groups[t]) groups[t] = [];
          groups[t].push(item);
        });

        const topicOrder = ['brakes', 'lights', 'road', 'signs', 'vehicle', 'steering', 'situations', 'docs', 'safety', 'misc'];
        bodyHtml = topicOrder
          .filter(t => groups[t] && groups[t].length > 0)
          .map(t => {
            const sub = SUBTOPICS[t];
            const sorted = [...groups[t]].sort((a, b) => a.en.localeCompare(b.en));
            const collapsed = state.settings.collapsedSubtopics[t] ? 'collapsed' : '';
            return `
              <div class="subtopic ${collapsed}" data-topic="${t}">
                <div class="subtopic-header" data-toggle-topic="${t}">
                  <div class="subtopic-title">
                    <span class="toggle">▼</span>
                    ${sub.en}
                    <span class="subtopic-ru">— ${sub.ru}</span>
                  </div>
                  <div class="subtopic-count">${sorted.length}</div>
                </div>
                <div class="items">
                  ${sorted.map(i => itemHtml(i, '')).join('')}
                </div>
              </div>
            `;
          }).join('');
      } else {
        const sorted = [...matched].sort((a, b) => a.en.localeCompare(b.en));
        bodyHtml = `<div class="items">${sorted.map(i => itemHtml(i, '')).join('')}</div>`;
      }

      return `
        <section class="category" id="cat-${key}">
          <div class="category-header">
            <div class="category-eyebrow">Category</div>
            <div class="category-title-block">
              <div class="category-titles">
                <h2>${cat.title_en}</h2>
                <div class="category-meta">
                  <span class="dk-name">${cat.title}</span>
                  <span style="color: var(--text-4); margin: 0 6px;">·</span>
                  <span>${cat.title_ru}</span>
                </div>
              </div>
              <div class="category-count">${matched.length} / ${cat.items.length}</div>
            </div>
          </div>
          ${bodyHtml}
        </section>
      `;
    }).join('');

    $('#empty').style.display = visibleCount === 0 ? 'block' : 'none';
  }

  /* ============== EVENT DELEGATION ============== */
  $('#categories').addEventListener('click', e => {
    // Toggle subtopic collapse
    const toggleEl = e.target.closest('[data-toggle-topic]');
    if (toggleEl) {
      const topic = toggleEl.dataset.toggleTopic;
      const sub = toggleEl.closest('.subtopic');
      const itemsEl = sub.querySelector('.items');
      const isCollapsed = sub.classList.contains('collapsed');

      if (isCollapsed) {
        // Expanding: from 0 to natural height
        sub.classList.remove('collapsed');
        itemsEl.style.maxHeight = '0px';
        // Force reflow then animate to actual height
        void itemsEl.offsetWidth;
        itemsEl.style.maxHeight = itemsEl.scrollHeight + 'px';
        // Cleanup after transition
        setTimeout(() => {
          if (!sub.classList.contains('collapsed')) {
            itemsEl.style.maxHeight = '';
          }
        }, 450);
      } else {
        // Collapsing: from natural height to 0
        itemsEl.style.maxHeight = itemsEl.scrollHeight + 'px';
        void itemsEl.offsetWidth;
        sub.classList.add('collapsed');
        itemsEl.style.maxHeight = '0px';
      }

      state.settings.collapsedSubtopics[topic] = !isCollapsed;
      saveSettings();
      return;
    }

    // Speak
    const speakBtn = e.target.closest('[data-action="speak"]');
    if (speakBtn) {
      e.stopPropagation();
      const text = speakBtn.dataset.text;
      const lang = speakBtn.dataset.lang || 'en';
      speak(text, speakBtn, null, lang);
      return;
    }

    // Mark known/hard
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn && (actionBtn.dataset.action === 'known' || actionBtn.dataset.action === 'hard')) {
      const termId = actionBtn.dataset.termId;
      const item = ALL_TERMS.find(t => t.id === termId);
      if (item) {
        toggleStatus(item, actionBtn.dataset.action);
        // Bump stat values briefly
        const target = actionBtn.dataset.action === 'known' ? '#meta-known' : '#meta-hard';
        const el = $(target);
        if (el) {
          el.classList.remove('bumping');
          void el.offsetWidth; // restart animation
          el.classList.add('bumping');
          setTimeout(() => el.classList.remove('bumping'), 400);
        }
        renderCategories();
      }
    }
  });

  /* ============== SEARCH / FILTERS ============== */
  let searchDebounce = null;
  $('#search').addEventListener('input', e => {
    state.query = e.target.value;
    $('#clear-search').classList.toggle('show', !!state.query);
    // Debounce search rendering — fuzzy matching is heavier than substring
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(renderCategories, 80);
  });

  $('#clear-search').addEventListener('click', () => {
    state.query = '';
    $('#search').value = '';
    $('#clear-search').classList.remove('show');
    renderCategories();
    $('#search').focus();
  });

  $$('#filter-group .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#filter-group .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeCat = btn.dataset.cat;
      renderCategories();
      buildFlashList();
      if (state.mode === 'flash') showCard();
      if (state.mode === 'quiz') startQuiz();
    });
  });

  $$('#status-row .chip').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#status-row .chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeStatus = btn.dataset.status;
      renderCategories();
      buildFlashList();
      if (state.mode === 'flash') showCard();
      if (state.mode === 'quiz') startQuiz();
    });
  });

  /* ============== MODE TOGGLE ============== */
  $$('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.mode = btn.dataset.mode;
      document.body.classList.remove('mode-list', 'mode-flash', 'mode-quiz');
      document.body.classList.add('mode-' + state.mode);
      if (state.mode === 'flash') {
        buildFlashList();
        showCard();
      } else if (state.mode === 'quiz') {
        startQuiz();
      }
    });
  });

  /* ============== FLASHCARDS ============== */
  function getFilteredList() {
    let list = ALL_TERMS.filter(item => {
      if (state.activeCat !== 'all' && item.catKey !== state.activeCat) return false;
      if (state.activeStatus !== 'all') {
        const s = getStatus(item);
        if (state.activeStatus !== s) return false;
      }
      return true;
    });
    return list;
  }

  function buildFlashList() {
    const list = getFilteredList();
    list.sort((a, b) => a.en.localeCompare(b.en));
    state.flashList = list;
    state.flashIdx = 0;
    state.flashFlipped = false;
  }

  function showCard() {
    const card = $('#flashcard');
    if (state.flashList.length === 0) {
      $('#flash-en').textContent = '—';
      $('#flash-curr').textContent = '0';
      $('#flash-total').textContent = '0';
      return;
    }
    const item = state.flashList[state.flashIdx];
    $('#flash-en').textContent = item.en;
    $('#flash-dk').textContent = item.dk;
    $('#flash-ru').textContent = item.ru;
    card.classList.toggle('flipped', state.flashFlipped);
    $('#flash-curr').textContent = state.flashIdx + 1;
    $('#flash-total').textContent = state.flashList.length;
    $('#flash-bar-fill').style.width = `${((state.flashIdx + 1) / state.flashList.length) * 100}%`;
    $('#flash-prev').disabled = state.flashIdx === 0;
    $('#flash-next').disabled = state.flashIdx === state.flashList.length - 1;
    $('#flash-side-label').textContent = state.flashFlipped ? 'Back' : 'Front';
    $('#flash-cat-label').textContent = state.activeCat;

    // Update mark buttons
    const status = getStatus(item);
    $('#flash-mark-known').classList.toggle('active', status === 'known');
    $('#flash-mark-known').classList.toggle('known', status === 'known');
    $('#flash-mark-hard').classList.toggle('active', status === 'hard');
    $('#flash-mark-hard').classList.toggle('hard', status === 'hard');
  }

  function flipCard() {
    const card = $('#flashcard');
    card.classList.add('flipping');
    setTimeout(() => {
      state.flashFlipped = !state.flashFlipped;
      showCard();
    }, 250);
    setTimeout(() => {
      card.classList.remove('flipping');
    }, 500);
  }
  function nextCard() {
    if (state.flashIdx < state.flashList.length - 1) {
      state.flashIdx++;
      state.flashFlipped = false;
      showCard();
    }
  }
  function prevCard() {
    if (state.flashIdx > 0) {
      state.flashIdx--;
      state.flashFlipped = false;
      showCard();
    }
  }
  function shuffleCards() {
    for (let i = state.flashList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.flashList[i], state.flashList[j]] = [state.flashList[j], state.flashList[i]];
    }
    state.flashIdx = 0;
    state.flashFlipped = false;
    showCard();
  }

  $('#flashcard').addEventListener('click', e => {
    if (e.target.closest('.action-btn')) return;
    flipCard();
  });
  $('#flash-flip').addEventListener('click', e => { e.stopPropagation(); flipCard(); });
  $('#flash-next').addEventListener('click', nextCard);
  $('#flash-prev').addEventListener('click', prevCard);
  $('#flash-shuffle').addEventListener('click', shuffleCards);

  $('#flash-mark-known').addEventListener('click', e => {
    e.stopPropagation();
    if (state.flashList.length === 0) return;
    const item = state.flashList[state.flashIdx];
    toggleStatus(item, 'known');
    showCard();
  });

  $('#flash-mark-hard').addEventListener('click', e => {
    e.stopPropagation();
    if (state.flashList.length === 0) return;
    const item = state.flashList[state.flashIdx];
    toggleStatus(item, 'hard');
    showCard();
  });

  $('#flash-speak').addEventListener('click', e => {
    e.stopPropagation();
    if (state.flashList.length === 0) return;
    const item = state.flashList[state.flashIdx];
    // Speak whichever side is currently shown — English on front, Danish on back
    if (state.flashFlipped) {
      speak(item.dk, e.currentTarget, null, 'da');
    } else {
      speak(item.en, e.currentTarget, null, 'en');
    }
  });

  /* ============== KEYBOARD ============== */
  document.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT') return;

    if (state.mode === 'flash') {
      if (e.key === 'ArrowRight') { e.preventDefault(); nextCard(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prevCard(); }
      else if (e.key === ' ') { e.preventDefault(); flipCard(); }
      else if (e.key === 'k' || e.key === 'K') {
        if (state.flashList.length === 0) return;
        const item = state.flashList[state.flashIdx];
        toggleStatus(item, 'known');
        showCard();
      } else if (e.key === 'h' || e.key === 'H') {
        if (state.flashList.length === 0) return;
        const item = state.flashList[state.flashIdx];
        toggleStatus(item, 'hard');
        showCard();
      } else if (e.key === 's' || e.key === 'S') {
        if (state.flashList.length === 0) return;
        const item = state.flashList[state.flashIdx];
        if (state.flashFlipped) {
          speak(item.dk, $('#flash-speak'), null, 'da');
        } else {
          speak(item.en, $('#flash-speak'), null, 'en');
        }
      }
    } else if (state.mode === 'quiz') {
      if (state.quiz.answered) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nextQuizQuestion(); }
      } else {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 4) {
          e.preventDefault();
          answerQuiz(num - 1);
        }
      }
    }
  });

  /* ============== QUIZ ============== */
  function startQuiz() {
    const list = getFilteredList();
    if (list.length < 4) {
      $('#quiz-card').style.display = 'none';
      $('#quiz-empty').style.display = 'block';
      return;
    }
    $('#quiz-card').style.display = '';
    $('#quiz-empty').style.display = 'none';

    state.quiz.list = [...list];
    // Shuffle
    for (let i = state.quiz.list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.quiz.list[i], state.quiz.list[j]] = [state.quiz.list[j], state.quiz.list[i]];
    }
    state.quiz.idx = 0;
    state.quiz.score = { correct: 0, wrong: 0, streak: 0, total: 0 };
    updateQuizScore();
    showQuizQuestion();
  }

  function showQuizQuestion() {
    if (state.quiz.idx >= state.quiz.list.length) {
      // restart
      state.quiz.idx = 0;
      // re-shuffle
      for (let i = state.quiz.list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.quiz.list[i], state.quiz.list[j]] = [state.quiz.list[j], state.quiz.list[i]];
      }
    }

    const item = state.quiz.list[state.quiz.idx];
    state.quiz.currentItem = item;
    state.quiz.answered = false;

    const dir = state.quiz.direction;
    let questionText, answerText, qLabel, sourceField, targetField;

    if (dir === 'en-to-ru') { sourceField = 'en'; targetField = 'ru'; qLabel = 'Translate to Russian'; }
    else if (dir === 'ru-to-en') { sourceField = 'ru'; targetField = 'en'; qLabel = 'Translate to English'; }
    else if (dir === 'en-to-dk') { sourceField = 'en'; targetField = 'dk'; qLabel = 'Translate to Danish'; }
    else if (dir === 'dk-to-en') { sourceField = 'dk'; targetField = 'en'; qLabel = 'Translate to English'; }
    else if (dir === 'ru-to-dk') { sourceField = 'ru'; targetField = 'dk'; qLabel = 'Translate to Danish'; }
    else if (dir === 'dk-to-ru') { sourceField = 'dk'; targetField = 'ru'; qLabel = 'Translate to Russian'; }

    questionText = item[sourceField];
    answerText = item[targetField];

    // Pick 3 distractors
    const candidates = ALL_TERMS.filter(t => t.id !== item.id && t[targetField] !== answerText);
    // shuffle and take 3
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const distractors = candidates.slice(0, 3).map(t => t[targetField]);

    // Build options array, place correct answer randomly
    const options = [...distractors];
    const correctIdx = Math.floor(Math.random() * 4);
    options.splice(correctIdx, 0, answerText);
    state.quiz.options = options;
    state.quiz.correctIdx = correctIdx;

    // Render
    $('#quiz-q-label').textContent = qLabel;
    $('#quiz-question-text').textContent = questionText;
    $('#quiz-curr').textContent = state.quiz.score.total + 1;
    $('#quiz-cat-label').textContent = state.activeCat;
    $('#quiz-bar-fill').style.width = ((state.quiz.idx) / state.quiz.list.length * 100) + '%';

    // Show speak button if source is English or Danish (skip RU which has no TTS need)
    const speakBtn = $('#quiz-speak');
    if (sourceField === 'en' || sourceField === 'dk') {
      speakBtn.style.display = '';
      const lang = sourceField;
      speakBtn.onclick = (e) => { e.stopPropagation(); speak(questionText, speakBtn, null, lang); };
    } else {
      speakBtn.style.display = 'none';
    }

    const optsContainer = $('#quiz-options');
    optsContainer.innerHTML = options.map((opt, i) => `
      <button class="quiz-option" data-idx="${i}">
        <span class="key">${i + 1}</span>
        <span>${escHtml(opt)}</span>
      </button>
    `).join('');

    $('#quiz-feedback').classList.remove('show');
    $('#quiz-skip').style.display = '';
    $('#quiz-next').style.display = 'none';

    optsContainer.querySelectorAll('.quiz-option').forEach(b => {
      b.addEventListener('click', () => answerQuiz(parseInt(b.dataset.idx)));
    });
  }

  function answerQuiz(idx) {
    if (state.quiz.answered) return;
    state.quiz.answered = true;
    const item = state.quiz.currentItem;
    const correct = idx === state.quiz.correctIdx;
    const correctIdx = state.quiz.correctIdx;

    const buttons = $('#quiz-options').querySelectorAll('.quiz-option');
    buttons.forEach((b, i) => {
      b.disabled = true;
      if (i === correctIdx) b.classList.add('correct');
      else if (i === idx && !correct) b.classList.add('wrong');
    });

    state.quiz.score.total++;
    if (correct) {
      state.quiz.score.correct++;
      state.quiz.score.streak++;
    } else {
      state.quiz.score.wrong++;
      state.quiz.score.streak = 0;
      // Auto-mark as difficult after 2 wrong attempts? For now, just mark as hard if user wants — let's auto-mark on first wrong
      if (getStatus(item) === 'untouched') {
        setStatus(item, 'hard');
      }
    }

    // If got it right and not already marked: don't auto-mark known (user decides)
    updateQuizScore();

    // Feedback
    const fb = $('#quiz-feedback');
    let html;
    if (correct) {
      html = `<div class="correct-answer" style="color: var(--correct);">✓ Correct!</div>`;
    } else {
      html = `<div class="correct-answer">Correct answer: <span style="color: var(--correct);">${escHtml(state.quiz.options[correctIdx])}</span></div>`;
    }
    // Show full term info
    html += `<div class="ru-text">${escHtml(item.en)} · <i>${escHtml(item.dk)}</i> · ${escHtml(item.ru)}</div>`;
    fb.innerHTML = html;
    fb.classList.add('show');

    $('#quiz-skip').style.display = 'none';
    $('#quiz-next').style.display = '';
  }

  function nextQuizQuestion() {
    state.quiz.idx++;
    showQuizQuestion();
  }

  function updateQuizScore() {
    $('#quiz-correct').textContent = state.quiz.score.correct;
    $('#quiz-wrong').textContent = state.quiz.score.wrong;
    $('#quiz-streak').textContent = state.quiz.score.streak;
    const total = state.quiz.score.correct + state.quiz.score.wrong;
    const acc = total > 0 ? Math.round(state.quiz.score.correct / total * 100) + '%' : '—';
    $('#quiz-accuracy').textContent = acc;
  }

  $('#quiz-skip').addEventListener('click', () => {
    if (state.quiz.answered) return;
    answerQuiz(-1); // marks as wrong
  });

  $('#quiz-next').addEventListener('click', nextQuizQuestion);

  $$('#quiz-direction button').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#quiz-direction button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.quiz.direction = btn.dataset.dir;
      startQuiz();
    });
  });

  /* ============== THEME ============== */
  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      $('#icon-sun').style.display = 'none';
      $('#icon-moon').style.display = 'block';
    } else {
      document.documentElement.removeAttribute('data-theme');
      $('#icon-sun').style.display = 'block';
      $('#icon-moon').style.display = 'none';
    }
  }

  $('#theme-toggle').addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    applyTheme(newTheme);
    try { localStorage.setItem('wex-exam-words-2026-theme', newTheme); } catch(e) {}
  });

  try {
    const saved = localStorage.getItem('wex-exam-words-2026-theme');
    if (saved) applyTheme(saved);
    else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      applyTheme('dark');
    }
  } catch(e) {}

  /* ============== RESET PROGRESS ============== */
  $('#reset-progress').addEventListener('click', () => {
    if (Object.keys(state.progress).length === 0) {
      alert('No progress to reset.');
      return;
    }
    if (confirm('Reset all progress? This will clear all "known" and "difficult" marks.')) {
      state.progress = {};
      saveProgress();
      updateStats();
      renderCategories();
    }
  });

  /* ============== INIT ============== */
  function init() {
    document.body.classList.add('mode-list');
    updateStats();
    renderQuickNav();
    renderCategories();
    buildFlashList();
    showCard();

    // ========== TTS init ==========
    if (state.tts.supported) {
      loadVoices();
      if ('onvoiceschanged' in speechSynthesis) {
        speechSynthesis.onvoiceschanged = loadVoices;
      }
      // Poll fallback for Safari etc.
      const interval = setInterval(() => {
        state.tts.pollAttempts++;
        loadVoices();
        if (state.tts.voicesLoaded || state.tts.pollAttempts > 20) {
          clearInterval(interval);
        }
      }, 250);
    }

    // Prime TTS on first user interaction (required for iOS/Chrome)
    const primeOnce = () => {
      primeTts();
      document.removeEventListener('click', primeOnce);
      document.removeEventListener('touchstart', primeOnce);
      document.removeEventListener('keydown', primeOnce);
    };
    document.addEventListener('click', primeOnce, { once: false, passive: true });
    document.addEventListener('touchstart', primeOnce, { once: false, passive: true });
    document.addEventListener('keydown', primeOnce, { once: false, passive: true });

    // Subtle elevation on topnav when scrolled
    const topnav = document.querySelector('.topnav');
    const onScroll = () => {
      const y = window.scrollY;
      if (topnav) topnav.classList.toggle('scrolled', y > 8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // TTS Dialog interactions
    $('#tts-dialog-close').addEventListener('click', closeTtsDialog);
    $('#tts-dialog-backdrop').addEventListener('click', closeTtsDialog);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && $('#tts-dialog').classList.contains('open')) {
        closeTtsDialog();
      }
    });

    // Voice list interactions (delegated)
    $('#tts-voice-list').addEventListener('click', (e) => {
      // Test specific voice
      const testBtn = e.target.closest('[data-test-uri]');
      if (testBtn) {
        e.stopPropagation();
        const uri = testBtn.dataset.testUri;
        const voice = state.tts.allVoices.find(v => v.voiceURI === uri);
        if (voice) {
          const lang = (voice.lang || '').toLowerCase();
          let sample;
          if (lang.startsWith('da')) sample = 'Sikkerhedsafstand';
          else if (lang.startsWith('en')) sample = 'Braking distance';
          else if (lang.startsWith('ru')) sample = 'Тормозной путь';
          else sample = 'Hello';
          speak(sample, testBtn, voice);
        }
        return;
      }
      // Select voice
      const voiceBtn = e.target.closest('[data-voice-uri]');
      if (voiceBtn) {
        const uri = voiceBtn.dataset.voiceUri;
        saveVoicePref(uri);
        // Re-render dialog to show selection
        openTtsDialog();
      }
    });

    // Open TTS dialog button
    const openBtn = $('#tts-settings-btn');
    if (openBtn) openBtn.addEventListener('click', openTtsDialog);

    const helpLink = $('#tts-help-link');
    if (helpLink) helpLink.addEventListener('click', (e) => { e.preventDefault(); showTtsHelp(); });
  }

  init();
