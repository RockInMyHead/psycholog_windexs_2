import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Play, Square, Heart } from "lucide-react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { psychologistAI, openai, type ChatMessage } from "@/services/openai";

interface MeditationType {
  id: string;
  name: string;
  description: string;
}

interface PoseAnalysisResult {
  isCorrect: boolean;
  feedback: string;
}

interface YogaPose {
  id: string;
  name: string;
  description: string;
  difficulty?: string;
  benefits?: string[];
  instructions?: string[];
}

const MeditationWithMarque = () => {
  const { user: authUser } = useAuth();

  // States
  const [step, setStep] = useState<"select_meditation" | "select_time" | "select_poses" | "meditating">("select_meditation");
  const [selectedMeditation, setSelectedMeditation] = useState<MeditationType | null>(null);
  const [selectedTime, setSelectedTime] = useState<number | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [sessionText, setSessionText] = useState<string>("");
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [meditationGuidanceStep, setMeditationGuidanceStep] = useState(0);

  // Wise quotes for meditation completion
  const wiseQuotes = [
    "Медитация - это не побег от жизни, а глубокое погружение в неё.",
    "Каждый вдох - это новая возможность, каждый выдох - освобождение.",
    "В тишине ума рождаются великие идеи и глубокие прозрения.",
    "Медитация учит нас, что настоящее счастье находится внутри нас.",
    "Регулярная практика медитации - это инвестиция в ваше душевное благополучие.",
    "В моменты тишины мы слышим голос нашей истинной природы.",
    "Медитация - мост между хаосом внешнего мира и спокойствием внутреннего.",
    "Каждое завершенное занятие медитацией делает вас сильнее и мудрее."
  ];

  const getRandomQuote = () => wiseQuotes[Math.floor(Math.random() * wiseQuotes.length)];

  // Toggle pose selection
  const togglePoseSelection = (pose: YogaPose) => {
    setUserSelectedPoses(prev => {
      const isSelected = prev.some(p => p.id === pose.id);
      if (isSelected) {
        return prev.filter(p => p.id !== pose.id);
      } else {
        return [...prev, pose];
      }
    });
  };
  const [poseResult, setPoseResult] = useState<PoseAnalysisResult | null>(null);
  const [currentYogaPose, setCurrentYogaPose] = useState<YogaPose | null>(null);
  const [poseStartTime, setPoseStartTime] = useState(0);
  const [selectedYogaPoses, setSelectedYogaPoses] = useState<YogaPose[]>([]);
  const [userSelectedPoses, setUserSelectedPoses] = useState<YogaPose[]>([]);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const photoIntervalRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const conversationRef = useRef<ChatMessage[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const ttsQueueRef = useRef<string[]>([]);
  const isSpeakingRef = useRef(false);
  const lastPoseFeedbackRef = useRef<number>(0); // Timestamp of last pose feedback
  const guidanceIntervalRef = useRef<number | null>(null); // For regular meditation guidance

  /*
  // Yoga meditation plans for different durations
  const yogaMeditationPlans = {
    5: [
      { poseId: "sukhasana", duration: 5 } // Одна комфортная поза для короткой медитации
    ],
    10: [
      { poseId: "sukhasana", duration: 3 },
      { poseId: "vajrasana", duration: 4 },
      { poseId: "sukhasana", duration: 3 } // Возврат к комфортной позе
    ],
    15: [
      { poseId: "sukhasana", duration: 3 },
      { poseId: "vajrasana", duration: 3 },
      { poseId: "virasana", duration: 3 },
      { poseId: "padmasana", duration: 3 },
      { poseId: "sukhasana", duration: 3 } // Возврат к комфортной позе
    ],
    20: [
      { poseId: "sukhasana", duration: 4 },
      { poseId: "vajrasana", duration: 4 },
      { poseId: "virasana", duration: 4 },
      { poseId: "padmasana", duration: 4 },
      { poseId: "siddhasana", duration: 2 },
      { poseId: "sukhasana", duration: 2 } // Длительный отдых
    ],
    25: [
      { poseId: "sukhasana", duration: 4 },
      { poseId: "vajrasana", duration: 4 },
      { poseId: "baddha_konasana", duration: 3 },
      { poseId: "ardha_padmasana", duration: 4 },
      { poseId: "siddhasana", duration: 3 },
      { poseId: "virasana", duration: 4 },
      { poseId: "sukhasana", duration: 3 } // Финальный отдых
    ],
    30: [
      { poseId: "sukhasana", duration: 4 },
      { poseId: "vajrasana", duration: 4 },
      { poseId: "baddha_konasana", duration: 3 },
      { poseId: "virasana", duration: 4 },
      { poseId: "ardha_padmasana", duration: 4 },
      { poseId: "padmasana", duration: 4 },
      { poseId: "siddhasana", duration: 3 },
      { poseId: "sukhasana", duration: 4 } // Продолжительный финальный отдых
    ]
  };
  */

  /*
  // Yoga poses for meditation
  const yogaPoses = [
    {
      id: "sukhasana",
      name: "Сукхасана (Простая поза)",
      sanskrit: "Sukhasana",
      description: "Базовая поза для медитации",
      instructions: "Сядьте со скрещенными ногами, позвоночник прямой, руки на коленях",
      benefits: "Улучшает концентрацию, успокаивает ум",
      difficulty: "Начинающий",
      duration: 2 // минуты на позу
    },
    {
      id: "padmasana",
      name: "Падмасана (Поза лотоса)",
      sanskrit: "Padmasana",
      description: "Классическая поза медитации",
      instructions: "Каждую стопу положите на противоположное бедро, позвоночник прямой",
      benefits: "Стабилизирует энергию, улучшает осанку",
      difficulty: "Средний",
      duration: 3
    },
    {
      id: "siddhasana",
      name: "Сиддхасана (Совершенная поза)",
      sanskrit: "Siddhasana",
      description: "Поза для духовного роста",
      instructions: "Одну пятку прижмите к промежности, вторую поверх первой, позвоночник прямой",
      benefits: "Активизирует энергию Кундалини",
      difficulty: "Продвинутый",
      duration: 3
    },
    {
      id: "vajrasana",
      name: "Ваджрасана (Поза алмаза)",
      sanskrit: "Vajrasana",
      description: "Поза для пищеварения и медитации",
      instructions: "Колени вместе, сядьте на пятки, спина прямая",
      benefits: "Улучшает пищеварение, укрепляет ноги",
      difficulty: "Начинающий",
      duration: 2
    },
    {
      id: "virasana",
      name: "Вирасана (Поза героя)",
      sanskrit: "Virasana",
      description: "Поза для развития силы воли",
      instructions: "Колени вместе, сядьте между пятками, спина прямая",
      benefits: "Укрепляет колени и лодыжки",
      difficulty: "Средний",
      duration: 2
    },
    {
      id: "baddha_konasana",
      name: "Баддха Конасана (Поза бабочки)",
      sanskrit: "Baddha Konasana",
      description: "Поза для раскрытия тазобедренных суставов",
      instructions: "Стопы вместе, колени в стороны, позвоночник прямой",
      benefits: "Улучшает гибкость, успокаивает ум",
      difficulty: "Начинающий",
      duration: 2
    },
    {
      id: "ardha_padmasana",
      name: "Ардха Падмасана (Полулотос)",
      sanskrit: "Ardha Padmasana",
      description: "Подготовка к полной позе лотоса",
      instructions: "Одну стопу положите на противоположное бедро, позвоночник прямой",
      benefits: "Развивает концентрацию, улучшает осанку",
      difficulty: "Средний",
      duration: 3
    }
  ];
  */

  // Meditation types
  const meditations: MeditationType[] = [
    {
      id: "breathing",
      name: "Дыхательная медитация",
      description: "Сосредоточьтесь на дыхании для спокойствия"
    },
    {
      id: "body_scan",
      name: "Сканирование тела",
      description: "Медленное осознавание каждой части тела"
    },
    {
      id: "loving_kindness",
      name: "Медитация любящей доброты",
      description: "Развивайте сочувствие к себе и другим"
    },
    {
      id: "visualization",
      name: "Визуализация",
      description: "Воображение спокойного места"
    },
    {
      id: "mindfulness",
      name: "Осознанность",
      description: "Живите настоящим моментом"
    },
    /*
    {
      id: "yoga_meditation",
      name: "Йога-медитация",
      description: "Медитация в йога-позах с контролем выполнения"
    }
    */
  ];

  const times = [5, 10, 15, 20, 25, 30]; // минуты

  // Get guidance for regular meditations
  // Meditation guidance sequences
  const meditationGuidanceSequences = {
    breathing: [
      "Обратите внимание на ваше дыхание. Дышите медленно и глубоко, чувствуя как воздух наполняет легкие.",
      "Почувствуйте, как при вдохе живот поднимается, а при выдохе опускается. Дышите спокойно.",
      "Если мысли отвлекают, мягко верните внимание к дыханию. Вдох... выдох...",
      "Представьте, как с каждым вдохом в вас входит спокойствие, а с выдохом уходит напряжение.",
      "Продолжайте дышать естественно. Ваше дыхание - якорь в настоящем моменте.",
      "Заметьте ритм вашего дыхания. Не пытайтесь его контролировать, просто наблюдайте.",
      "Почувствуйте, как дыхание само собой становится более спокойным и ровным.",
      "Ваше дыхание - естественный процесс. Позвольте ему течь свободно.",
      "Каждый вдох приносит свежую энергию, каждый выдох уносит заботы.",
      "Сосчитайте свои вдохи от 1 до 10, затем начните заново. Это поможет сосредоточиться.",
      "Почувствуйте, как воздух входит через нос, наполняет легкие и выходит через рот.",
      "Представьте, что с каждым выдохом вы отпускаете все напряжение из тела.",
      "Обратите внимание на паузу между вдохом и выдохом. Почувствуйте совершенство момента.",
      "Если дыхание становится поверхностным, мягко углубите его, но без напряжения.",
      "Ваше дыхание - это дар жизни. Будьте благодарны за каждый вдох.",
      "Почувствуйте, как ритм дыхания успокаивает ваш ум и тело.",
      "Представьте, что ваше дыхание - это волна океана, приходящая и уходящая.",
      "Заметьте, как дыхание объединяет тело и разум в гармоничное целое.",
      "Позвольте дыханию быть вашим учителем - естественным, мудрым, спокойным.",
      "Завершите осознанием того, как дыхание поддерживает вас в каждый момент жизни."
    ],
    body_scan: [
      "Начните с пальцев ног и медленно перемещайте внимание вверх по телу, расслабляя каждую часть.",
      "Почувствуйте стопы, лодыжки, икры. Осознайте контакт с поверхностью под вами.",
      "Переместите внимание на бедра, таз, нижнюю часть спины. Позвольте им расслабиться.",
      "Почувствуйте живот, грудную клетку. Обратите внимание на дыхание в этой области.",
      "Перейдите к плечам, рукам, кистям. Почувствуйте, как они отдыхают.",
      "Обратите внимание на шею, лицо, макушку. Позвольте всему телу быть в покое.",
      "Вернитесь к пальцам ног. Почувствуйте, как расслабление распространяется по всему телу.",
      "Обратите внимание на общую позу тела. Позвольте ему полностью отдохнуть.",
      "Почувствуйте единство всех частей тела в состоянии покоя.",
      "Продолжайте осознавать тело как единое целое, наполненное спокойствием.",
      "Сосредоточьтесь на пальцах ног. Почувствуйте, как они полностью расслаблены.",
      "Переместите внимание на свод стопы. Заметьте любые ощущения в этой области.",
      "Почувствуйте лодыжки и нижнюю часть голеней. Позвольте мышцам расслабиться.",
      "Обратите внимание на колени. Почувствуйте, как они отдыхают на поверхности.",
      "Перейдите к бедрам. Заметьте, как расслабление распространяется вверх.",
      "Почувствуйте тазовую область. Позвольте ей полностью отдохнуть.",
      "Обратите внимание на нижнюю часть спины. Почувствуйте поддержку под вами.",
      "Переместите внимание на живот и диафрагму. Заметьте ритм дыхания.",
      "Почувствуйте грудную клетку и область сердца. Позвольте им быть спокойными.",
      "Обратите внимание на плечи. Почувствуйте, как они опускаются вниз.",
      "Перейдите к рукам - от плеч до кончиков пальцев. Полностью расслабьте их.",
      "Почувствуйте шею и затылок. Позвольте голове отдыхать на плечах.",
      "Обратите внимание на лицо - лоб, глаза, щеки, рот. Расслабьте все мышцы.",
      "Почувствуйте макушку головы. Завершите сканирование ощущением покоя.",
      "Теперь осознайте все тело как единое целое. Почувствуйте глубокое расслабление."
    ],
    loving_kindness: [
      "Пошлите любовь и доброту сначала себе. Повторите: 'Пусть я буду счастлив, пусть я буду здоров'.",
      "Теперь пошлите любовь близкому человеку. Пожелайте ему счастья и благополучия.",
      "Распространите любовь на всех людей, которых знаете. Почувствуйте связь со всеми.",
      "Пошлите любовь даже тем, с кем у вас сложные отношения. Простите и отпустите.",
      "Распространите любовь на всех людей планеты. Мы все заслуживаем доброты и сострадания.",
      "Пошлите любовь всем живым существам. Почувствуйте всеобщую связь жизни.",
      "Завершите, послав любовь обратно себе. Почувствуйте, как она наполняет вас.",
      "Заметьте, как практика любящей доброты меняет ваше восприятие мира.",
      "Продолжайте культивировать это чувство в повседневной жизни.",
      "Начните с себя: 'Пусть я найду внутренний покой и счастье в этот момент'.",
      "Пошлите любовь своему телу. Почувствуйте благодарность за его службу.",
      "Распространите доброту на членов семьи. Пожелайте им здоровья и радости.",
      "Пошлите любовь друзьям. Почувствуйте теплоту этих отношений.",
      "Вспомните кого-то, кто помог вам в трудную минуту. Пошлите ему благодарность.",
      "Пошлите любовь коллегам и знакомым. Мы все часть большой сети жизни.",
      "Распространите доброту на незнакомцев. Каждый человек имеет свою историю.",
      "Пошлите любовь тем, кто причинил вам боль. Это освобождает ваше сердце.",
      "Распространите любовь на всю планету. Почувствуйте единство человечества.",
      "Пошлите любовь животным и природе. Мы все взаимосвязаны.",
      "Завершите, наполнив себя безусловной любовью и добротой ко всему сущему."
    ],
    visualization: [
      "Представьте спокойное место - лес, пляж или горы. Почувствуйте это место всеми органами чувств.",
      "Посмотрите вокруг: какие цвета, формы, детали вы видите в этом месте?",
      "Почувствуйте воздух на коже, температуру, легкий ветерок или тепло солнца.",
      "Услышьте звуки этого места: шелест листьев, шум волн, пение птиц.",
      "Погрузитесь глубже в это место. Почувствуйте полное расслабление и безопасность.",
      "Обратите внимание на запахи этого места - свежая трава, соленый морской воздух, цветы.",
      "Почувствуйте текстуры - мягкая земля под ногами, прохладный бриз, теплое солнце.",
      "Позвольте этому месту стать вашим убежищем. Здесь вы всегда в безопасности.",
      "Когда будете готовы, медленно вернитесь в настоящее, сохранив ощущение покоя.",
      "Выберите свое идеальное место покоя. Что это за место? Создайте его в воображении.",
      "Посмотрите на небо в вашем воображаемом месте. Какие облака, солнце или звезды?",
      "Почувствуйте поверхность под ногами. Земля, песок, трава - какая она на ощупь?",
      "Услышьте далекие звуки этого места. Что вы слышите вдалеке?",
      "Обратите внимание на растения и цветы вокруг. Какие они, как пахнут?",
      "Почувствуйте, как тело полностью расслабляется в этом безопасном пространстве.",
      "Представьте источник чистой воды неподалеку. Услышьте ее журчание.",
      "Почувствуйте абсолютную безопасность. Здесь ничто не может навредить вам.",
      "Добавьте в это место что-то личное - любимый предмет или воспоминание.",
      "Позвольте этому месту стать вашим внутренним святилищем для трудных моментов.",
      "Когда будете готовы выйти, знайте, что это место всегда доступно в вашем уме."
    ],
    mindfulness: [
      "Замечайте свои мысли и чувства без осуждения. Просто наблюдайте, как приходят и уходят.",
      "Обратите внимание на физические ощущения в теле. Где есть напряжение? Где комфорт?",
      "Наблюдайте за мыслями, как за облаками в небе. Они приходят и уходят.",
      "Почувствуйте эмоции в теле. Где в теле вы чувствуете радость, грусть или спокойствие?",
      "Будьте здесь и сейчас. Каждый момент - это возможность быть осознанным.",
      "Обратите внимание на дыхание. Почувствуйте естественный ритм жизни.",
      "Заметьте звуки вокруг вас. Принимайте их без оценки.",
      "Осознайте позу тела. Почувствуйте контакт с поверхностью.",
      "Практикуйте осознанность в повседневной жизни. Каждый момент ценен.",
      "Завершите, сохранив ощущение присутствия в настоящем моменте.",
      "Начните с осознания дыхания. Почувствуйте воздух, входящий и выходящий.",
      "Заметьте мысли без вовлеченности. Просто отметьте: 'вот мысль о работе'.",
      "Обратите внимание на эмоции. Назовите их: 'вот тревога', 'вот спокойствие'.",
      "Почувствуйте вес своего тела на сиденье. Осознайте этот контакт.",
      "Услышьте звуки в комнате. Принимайте каждый звук как часть настоящего.",
      "Заметьте позу тела. Какие мышцы работают, чтобы удерживать эту позу?",
      "Осознайте температуру воздуха на коже. Тепло, прохлада, нейтрально.",
      "Обратите внимание на свет в комнате. Как он влияет на ваше восприятие?",
      "Почувствуйте энергию в теле. Где есть движение, где покой?",
      "Завершите осознанием того, что осознанность - это всегда доступный выбор."
    ]
  };

  const getMeditationGuidance = (meditationType: string, step: number = 0): string | null => {
    const sequence = meditationGuidanceSequences[meditationType as keyof typeof meditationGuidanceSequences];
    if (!sequence) return null;
    return sequence[step % sequence.length] || null;
  };

  // Start webcam
  const startWebcam = async () => {
    console.log("📹 START WEBCAM called");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      console.log("📹 WEBCAM stream obtained");

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        console.log("📹 WEBCAM stream assigned to video element");
      } else {
        console.log("❌ WEBCAM videoRef.current is null");
      }
    } catch (error) {
      console.error("❌ WEBCAM Error accessing webcam:", error);
    }
  };

  // Capture photo and analyze pose
  const captureAndAnalyzePose = async () => {
    console.log("🎯 CAPTURE AND ANALYZE POSE called");

    if (!canvasRef.current || !videoRef.current) {
      console.log("❌ Missing canvas or video");
      return;
    }

    console.log("✅ Starting pose capture...");
    console.log("📹 Video element state:", {
      videoWidth: videoRef.current.videoWidth,
      videoHeight: videoRef.current.videoHeight,
      readyState: videoRef.current.readyState,
      networkState: videoRef.current.networkState
    });

    try {
      const context = canvasRef.current.getContext("2d");
      if (!context) {
        console.log("❌ Canvas context error");
        return;
      }

      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;

      if (canvasRef.current.width === 0 || canvasRef.current.height === 0) {
        console.log("❌ Canvas size is 0 - video not ready");
        return;
      }

      console.log("✅ Drawing image to canvas");
      context.drawImage(videoRef.current, 0, 0);
      const imageData = canvasRef.current.toDataURL("image/jpeg");
      console.log("✅ Image captured, size:", imageData.length, "bytes");

      // Отправляем фото в OpenAI для анализа позы
      const analysis = await analyzeUserPose(imageData);
      setPoseResult(analysis);

      // Если поза неправильная, Марк дает рекомендацию напрямую
      if (!analysis.isCorrect && analysis.feedback) {
        // Для всех поз даем советы каждые 30 секунд
        const minInterval = 30000;
        const timeSinceLastFeedback = Date.now() - lastPoseFeedbackRef.current;

        if (timeSinceLastFeedback >= minInterval) {
          lastPoseFeedbackRef.current = Date.now();

          // Проверяем, что feedback не содержит вопросов
          const cleanFeedback = analysis.feedback
            .replace(/[?¿]/g, '') // Убираем вопросительные знаки
            .replace(/\b(как|что|почему|зачем|когда)\s+/gi, '') // Убираем вопросительные слова
            .trim();

          // Озвучиваем рекомендацию напрямую
          await speakText(cleanFeedback || analysis.feedback);
        }
      }
    } catch (error) {
      console.error("Error analyzing pose:", error);
    }
  };

  // Analyze pose with OpenAI Vision
  const analyzeUserPose = async (imageBase64: string): Promise<PoseAnalysisResult> => {
    try {
      console.log("🔍 Analyzing pose with OpenAI...");
      // Извлекаем base64 без префикса data:image
      const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
      console.log("🔍 Base64 data prepared, length:", base64Data.length);

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Ты эксперт по йоге. Анализируй выполнение позы ${currentYogaPose?.name || 'медитации'} на фото.

ПОЗА: ${currentYogaPose?.name || 'Базовая поза'}
ИНСТРУКЦИИ: ${currentYogaPose?.instructions || 'Сядьте удобно, спина прямая'}

БЫТЬ МАКСИМАЛЬНО ЛОЯЛЬНЫМ: Не требуй идеальной осанки, позволь естественные небольшие отклонения. Считай позу правильной, если человек выполняет ее в целом правильно и комфортно.

Оцени качество выполнения этой конкретной позы:
1. Правильно ли расположены ноги/ступни?
2. Правильное ли положение рук?
3. Спина относительно прямая без чрезмерного напряжения?
4. Голова в относительно нейтральном положении?

Будь конструктивен - если есть заметные ошибки, дай мягкий совет по исправлению. Не будь слишком строгим - позволь небольшие отклонения от идеала.

ВАЖНО: ДАВАЙ ПРЯМЫЕ ИНСТРУКЦИИ, НЕ ЗАДАВАЙ ВОПРОСОВ! Не спрашивай "как вы чувствуете" или "что вы думаете". Просто давай четкие указания по исправлению позы.

Ответ ТОЛЬКО в JSON: {"isCorrect": true/false, "feedback": "краткая оценка или совет"}`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Data}`,
                },
              },
            ],
          },
        ],
        max_completion_tokens: 100,
      });

      if (!completion.choices || !completion.choices[0] || !completion.choices[0].message) {
        return {
          isCorrect: true,
          feedback: "Продолжайте медитировать",
        };
      }

      const content = completion.choices[0].message.content || "";
      console.log("🔍 OpenAI response:", content);

      try {
        // Пытаемся распарсить JSON из ответа
        const jsonMatch = content.match(/\{[^{}]*\}/);
        if (jsonMatch) {
          console.log("✅ JSON found in response");
          const parsed = JSON.parse(jsonMatch[0]);
          console.log("✅ Pose analysis result:", parsed);
          return {
            isCorrect: parsed.isCorrect !== false,
            feedback: parsed.feedback || "Поза выглядит хорошо",
          };
        }

        // Если не нашли JSON, попробуем извлечь информацию из текста
        // По умолчанию считаем позу хорошей, если нет явных проблем
        console.log("⚠️ No JSON found, parsing text response");
        const hasProblems = content.toLowerCase().includes('выпрямите') ||
                           content.toLowerCase().includes('расслабьте') ||
                           content.toLowerCase().includes('голову') ||
                           content.toLowerCase().includes('руки') ||
                           content.toLowerCase().includes('исправьте');

        const isCorrect = !hasProblems;

        return {
          isCorrect,
          feedback: content.length > 50 ? "Продолжайте медитировать" : content,
        };

      } catch (parseError) {
        console.error("❌ Error parsing pose response:", parseError);
        // При ошибке парсинга считаем позу хорошей
        return {
          isCorrect: true,
          feedback: "Поза хорошая",
        };
      }

    } catch (error) {
      return {
        isCorrect: true,
        feedback: "Продолжайте медитировать",
      };
    }
  };

  // Process TTS queue
  const processTTSQueue = async () => {
    if (isSpeakingRef.current || ttsQueueRef.current.length === 0) {
      return;
    }

    isSpeakingRef.current = true;
    const text = ttsQueueRef.current.shift()!;

    try {
      const audioBuffer = await psychologistAI.synthesizeSpeech(text);
      const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(audioBlob);

      const audio = new Audio(audioUrl);

      audio.onended = () => {
        isSpeakingRef.current = false;
        // Process next item in queue
        setTimeout(() => processTTSQueue(), 500); // Small delay between messages
      };

      audio.onerror = () => {
        isSpeakingRef.current = false;
        setTimeout(() => processTTSQueue(), 500);
      };

      await audio.play();
    } catch (error) {
      console.error("TTS error:", error);
      isSpeakingRef.current = false;
      setTimeout(() => processTTSQueue(), 500);
    }
  };

  // Text to speech with queue management
  const speakText = async (text: string) => {
    ttsQueueRef.current.push(text);
    processTTSQueue();
  };

  // Change to next yoga pose
  const changeYogaPose = async () => {
    if (selectedYogaPoses.length === 0) {
      return;
    }

    const currentIndex = currentYogaPose ? selectedYogaPoses.indexOf(currentYogaPose) : -1;
    const nextIndex = (currentIndex + 1) % selectedYogaPoses.length;
    const nextPose = selectedYogaPoses[nextIndex];

    setCurrentYogaPose(nextPose);
    setPoseStartTime(Date.now());

    // Сбрасываем timestamp последнего совета для новой позы
    lastPoseFeedbackRef.current = 0;

    // Announce pose change
    const poseDuration = nextPose.duration;
    const announcement = `Переходим к позе ${nextPose.name}. ${nextPose.instructions}. Удерживайте позу ${poseDuration} минут${poseDuration !== 1 ? '' : 'у'}.`;
    await speakText(announcement);

  };

  // Start meditation session
  const startMeditation = async () => {
    console.log("🚀 START MEDITATION called", { selectedMeditation: selectedMeditation?.id, selectedTime, step });
    if (!selectedMeditation || !selectedTime) {
      console.log("❌ Missing selectedMeditation or selectedTime");
      return;
    }

    // Additional check for yoga meditation - now we apply plan automatically
    // if (selectedMeditation.id === "yoga_meditation" && selectedYogaPoses.length === 0) return;

    setStep("meditating");
    setIsSessionActive(true);
    console.log("✅ Set isSessionActive to true");
    setElapsedTime(0);

    // Regular meditation - start with first guidance
    setMeditationGuidanceStep(0);
    const initialGuidance = getMeditationGuidance(selectedMeditation.id, 0);

    const greeting = `Начинаем ${selectedMeditation.name} на ${selectedTime} минут. ${initialGuidance || 'Сосредоточьтесь и наслаждайтесь процессом.'}`;
    conversationRef.current = [
      { role: "system", content: `Ты ведущий ${selectedMeditation.name}. Давай мягкие, успокаивающие инструкции.` },
      { role: "assistant", content: greeting }
    ];

    await speakText(greeting);

    // Set up periodic guidance for regular meditation
    guidanceIntervalRef.current = window.setInterval(() => {
      if (!isSessionActive) {
        if (guidanceIntervalRef.current) {
          clearInterval(guidanceIntervalRef.current);
          guidanceIntervalRef.current = null;
        }
        return;
      }

      setMeditationGuidanceStep(prev => {
        const nextStep = prev + 1;
        const guidance = getMeditationGuidance(selectedMeditation.id, nextStep);

        if (guidance) {
          console.log(`Speaking guidance step ${nextStep} for ${selectedMeditation.name}`);
          speakText(guidance);
        }

        return nextStep;
      });
    }, 60000); // Every minute for regular meditations

    // Start background music for all types
    startBackgroundMusic();

    // Main timer
    console.log("⏰ STARTING MAIN TIMER for", selectedTime, "minutes");
    timerRef.current = window.setInterval(() => {
      setElapsedTime((prev) => {
        const newTime = prev + 1;

        /*
        // For yoga meditation, check pose changes
        if (selectedMeditation.id === "yoga_meditation" && currentYogaPose) {
          const poseDuration = currentYogaPose.duration;
          if ((Date.now() - poseStartTime) >= poseDuration * 60 * 1000) {
            changeYogaPose();
          }
        }
        */

        if (newTime >= selectedTime! * 60) {
          console.log("⏰ TIMER END: newTime", newTime, "selectedTime", selectedTime, "limit", selectedTime! * 60);
          endMeditation();
          return newTime;
        }
        return newTime;
      });
    }, 1000);
  };

  // End meditation
  const endMeditation = () => {
    console.log("🏁 END MEDITATION called - stopping session");
    setIsSessionActive(false);

    if (photoIntervalRef.current) clearInterval(photoIntervalRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (guidanceIntervalRef.current) clearInterval(guidanceIntervalRef.current);

    /*
    // Stop webcam only for yoga meditation
    if (selectedMeditation?.id === "yoga_meditation" && streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    */

    stopBackgroundMusic();

    // Clear TTS queue and stop current speech to prevent conflicts
    ttsQueueRef.current = [];
    isSpeakingRef.current = false;

    // Small delay to ensure all TTS is stopped before showing modal
    setTimeout(() => {
      setShowCompletionModal(true);
    }, 500);

    // Reset states
    setStep("select_meditation");
    setSelectedMeditation(null);
    setSelectedTime(null);
    setCurrentYogaPose(null);
    setSelectedYogaPoses([]);
    setPoseStartTime(0);
    setElapsedTime(0);
    setPoseResult(null);
  };

  // Background music management
  const startBackgroundMusic = () => {
    const audio = new Audio("/de144d31b1f3b3f.mp3");
    audio.loop = true;
    audio.volume = 0.08;
    audio.play().catch((e) => console.warn("Audio play error:", e));
    audioElementRef.current = audio;
  };

  const stopBackgroundMusic = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }
  };

  // Timer format
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  /*
  // Auto-start first pose when poses are loaded
  useEffect(() => {
    if (step === "meditating" && selectedYogaPoses.length > 0 && !currentYogaPose && isSessionActive) {
      changeYogaPose();
    }
  }, [selectedYogaPoses, step, currentYogaPose, isSessionActive]);
  */

  /*
  // Photo interval for pose analysis
  useEffect(() => {
    if (selectedMeditation?.id === "yoga_meditation" && isSessionActive && step === "meditating") {
      console.log("📸 SETTING UP PHOTO INTERVAL - meditation is active");
      const interval = window.setInterval(() => {
        console.log("📸 PHOTO INTERVAL TICK - calling captureAndAnalyzePose");
        captureAndAnalyzePose();
      }, 30000);

      return () => {
        console.log("📸 CLEARING PHOTO INTERVAL");
        clearInterval(interval);
      };
    }
  }, [selectedMeditation, isSessionActive, step]);
  */

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (guidanceIntervalRef.current) {
        clearInterval(guidanceIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-calm-gradient">
      <Navigation />

      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-6xl">
          {/* Step 1: Select Meditation */}
          {step === "select_meditation" && (
            <>
              <div className="text-center mb-12 animate-fade-in">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
                  <span>🧘 Медитация с Марком</span>
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-3">
                  Выберите тип медитации
                </h1>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-12">
                {meditations.map((med) => (
                  <Card
                    key={med.id}
                    onClick={() => {
                      setSelectedMeditation(med);
                      setStep("select_time");
                    }}
                    className={`p-4 sm:p-6 lg:p-8 cursor-pointer transition-all hover:shadow-lg w-full ${
                      selectedMeditation?.id === med.id
                        ? "border-2 border-primary bg-primary/5"
                        : "border-2 border-border hover:border-primary/30"
                    }`}
                  >
                    <h3 className="text-xl font-bold text-foreground mb-2">{med.name}</h3>
                    <p className="text-muted-foreground">{med.description}</p>
                  </Card>
                ))}
              </div>

            </>
          )}

          {/* Step 2: Select Time */}
          {step === "select_time" && (
            <>
              <div className="text-center mb-12 animate-fade-in">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
                  Выберите продолжительность
                </h1>
                <p className="text-lg text-muted-foreground">
                  {selectedMeditation?.name}
                </p>
              </div>

              <div className="flex justify-center gap-3 sm:gap-6 mb-12 flex-wrap px-4">
                {times.map((time) => (
                  <Button
                    key={time}
                    onClick={() => setSelectedTime(time)}
                    variant={selectedTime === time ? "default" : "outline"}
                    size="lg"
                    className={
                      selectedTime === time
                        ? "bg-hero-gradient text-white text-lg sm:text-xl px-4 sm:px-8 py-4 sm:py-6 min-w-[80px]"
                        : "text-lg sm:text-xl px-4 sm:px-8 py-4 sm:py-6 min-w-[80px]"
                    }
                  >
                    {time} мин
                  </Button>
                ))}
              </div>

              <div className="flex justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("select_meditation");
                    setSelectedMeditation(null);
                    setSelectedTime(null);
                  }}
                >
                  Назад
                </Button>
                <Button
                  className="bg-hero-gradient text-white hover:shadow-lg"
                  size="lg"
                  disabled={!selectedTime}
                  onClick={() => {
                    if (selectedMeditation?.id === "yoga_meditation") {
                      setStep("select_poses");
                    } else {
                      startMeditation();
                    }
                  }}
                >
                  <Play className="w-5 h-5 mr-2" />
                  {selectedMeditation?.id === "yoga_meditation" ? "Выбрать позы" : "Начать медитацию"}
                </Button>
              </div>
            </>
          )}

          {/* Step 3: Select Yoga Poses */}
          {step === "select_poses" && (
            <>
              <div className="text-center mb-12 animate-fade-in">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
                  Выберите йога-позы
                </h1>
                <p className="text-lg text-muted-foreground">
                  Выберите позы для вашей {selectedTime}-минутной йога-медитации
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Выбрано: {userSelectedPoses.length} поз{userSelectedPoses.length !== 1 ? '' : 'а'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 px-4 max-w-4xl mx-auto">
                {yogaPoses.map((pose) => {
                  const isSelected = userSelectedPoses.some(p => p.id === pose.id);
                  return (
                    <div
                      key={pose.id}
                      onClick={() => togglePoseSelection(pose)}
                      className={`
                        p-4 rounded-lg border-2 cursor-pointer transition-all
                        ${isSelected
                          ? 'border-primary bg-primary/10 shadow-md'
                          : 'border-border hover:border-primary/50'
                        }
                      `}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-4 h-4 rounded-full border-2 mt-1 flex-shrink-0 ${
                          isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'
                        }`}>
                          {isSelected && <div className="w-full h-full rounded-full bg-primary scale-50" />}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground">{pose.name}</h3>
                          <p className="text-sm text-muted-foreground italic mb-1">{pose.sanskrit}</p>
                          <p className="text-sm text-muted-foreground mb-2">{pose.description}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Сложность: {pose.difficulty}</span>
                            <span>•</span>
                            <span>{pose.duration} мин</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("select_time");
                    setUserSelectedPoses([]);
                  }}
                >
                  Назад
                </Button>
                <Button
                  className="bg-hero-gradient text-white hover:shadow-lg"
                  size="lg"
                  disabled={userSelectedPoses.length === 0}
                  onClick={() => {
                    // Set selected poses and start meditation
                    setSelectedYogaPoses(userSelectedPoses);
                    startMeditation();
                  }}
                >
                  <Play className="w-5 h-5 mr-2" />
                  Начать медитацию ({userSelectedPoses.length} поз{userSelectedPoses.length !== 1 ? '' : 'а'})
                </Button>
              </div>
            </>
          )}

          {/* Step 4: Meditation Session */}
          {step === "meditating" && (
            <>
              {selectedMeditation?.id === "yoga_meditation" ? (
                // Yoga meditation layout
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Video Preview */}
                <Card className="lg:col-span-1 p-4 bg-black rounded-xl overflow-hidden shadow-lg">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-auto rounded-lg"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                </Card>

                {/* Meditation Info */}
                <div className="lg:col-span-2 space-y-6">
                  <Card className="p-6 bg-card-gradient border-2 border-border">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">
                          {currentYogaPose?.name || "Подготовка..."}
                        </h2>
                        <p className="text-muted-foreground text-sm">
                          {currentYogaPose?.sanskrit}
                        </p>
                      </div>
                      <Badge className="bg-hero-gradient text-white text-lg px-4 py-2">
                        {formatTime(elapsedTime)} / {selectedTime}:00
                      </Badge>
                    </div>

                    {currentYogaPose && (
                      <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                        <p className="text-foreground font-medium mb-2">Инструкции:</p>
                        <p className="text-muted-foreground text-sm">{currentYogaPose.instructions}</p>
                        <p className="text-green-600 text-xs mt-2 font-medium">{currentYogaPose.benefits}</p>
                      </div>
                    )}

                    {poseResult && (
                      <div
                        className={`p-4 rounded-lg ${
                          poseResult.isCorrect
                            ? "bg-green-100 border border-green-300"
                            : "bg-yellow-100 border border-yellow-300"
                        }`}
                      >
                        <p className="text-foreground font-semibold">
                          {poseResult.isCorrect ? "✅ Поза правильная" : "⚠️ Поправьте позу"}
                        </p>
                        <p className="text-muted-foreground text-sm mt-1">
                          {poseResult.feedback}
                        </p>
                      </div>
                    )}
                  </Card>

                  <Button
                    onClick={endMeditation}
                    size="lg"
                    className="w-full bg-destructive text-white hover:bg-destructive/90"
                  >
                    <Square className="w-5 h-5 mr-2" />
                    Завершить медитацию
                  </Button>
                </div>
                </div>
              ) : (
                // Regular meditation layout
                <div className="text-center space-y-8">
                  <Card className="p-8 bg-card-gradient border-2 border-border max-w-md mx-auto">
                    <h2 className="text-3xl font-bold text-foreground mb-4">
                      {selectedMeditation?.name}
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      {selectedMeditation?.description}
                    </p>
                    <Badge className="bg-hero-gradient text-white text-xl px-6 py-3">
                      {formatTime(elapsedTime)} / {selectedTime}:00
                    </Badge>
                  </Card>

                  <Button
                    onClick={endMeditation}
                    size="lg"
                    className="bg-destructive text-white hover:bg-destructive/90 px-8"
                  >
                    <Square className="w-5 h-5 mr-2" />
                    Завершить медитацию
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Completion Modal */}
      <Dialog open={showCompletionModal} onOpenChange={setShowCompletionModal}>
        <DialogContent className="sm:max-w-md mx-4 p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-center text-lg sm:text-2xl font-bold text-foreground flex items-center justify-center gap-2">
              <Heart className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />
              <span>Поздравляем!</span>
            </DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-4">
            <div className="text-sm sm:text-base text-muted-foreground px-4 sm:px-6">
              Вы молодец! Вы успешно завершили медитацию.
            </div>
            <div className="bg-muted/50 p-4 sm:p-6 rounded-lg border-l-4 border-primary mx-4 sm:mx-6">
              <p className="text-sm sm:text-base italic text-muted-foreground leading-relaxed break-words">
                "{getRandomQuote()}"
              </p>
            </div>
            <div className="flex justify-center pt-4">
              <Button
                onClick={() => {
                  setShowCompletionModal(false);
                  // Reset states after modal closes
                  setStep("select_meditation");
                  setSelectedMeditation(null);
                  setSelectedTime(null);
                  setCurrentYogaPose(null);
                  setSelectedYogaPoses([]);
                  setPoseStartTime(0);
                  setElapsedTime(0);
                  setPoseResult(null);
                }}
                className="bg-hero-gradient text-white hover:shadow-lg"
              >
                Отлично!
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MeditationWithMarque;

