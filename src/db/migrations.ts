import { db } from './index';
import * as schema from './schema';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

// Initialize database with default data
export async function initializeDatabase() {
  try {
    console.log('Initializing database...');

    // Create tables
    await createTables();

    // Insert default quotes
    await seedQuotes();

    // Create default user if not exists
    await createDefaultUser();

    console.log('Database initialized successfully!');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

async function createTables() {
  console.log('Creating database tables...');

  // Create all tables explicitly using raw SQL
  const createTablesSQL = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      avatar TEXT,
      password_hash TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      message_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      role TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audio_calls (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      duration INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      notes TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS meditation_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      meditation_title TEXT NOT NULL,
      duration INTEGER NOT NULL,
      completed_at INTEGER NOT NULL,
      rating INTEGER,
      notes TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      author TEXT NOT NULL,
      category TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quote_views (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      quote_id TEXT NOT NULL,
      viewed_at INTEGER NOT NULL,
      liked INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (quote_id) REFERENCES quotes(id)
    );

    CREATE TABLE IF NOT EXISTS user_stats (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      total_chat_sessions INTEGER NOT NULL DEFAULT 0,
      total_audio_calls INTEGER NOT NULL DEFAULT 0,
      total_meditation_minutes INTEGER NOT NULL DEFAULT 0,
      total_quotes_viewed INTEGER NOT NULL DEFAULT 0,
      last_activity INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      plan TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      yookassa_payment_id TEXT,
      started_at INTEGER NOT NULL,
      expires_at INTEGER,
      auto_renew INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      audio_sessions_limit INTEGER,
      audio_sessions_used INTEGER DEFAULT 0,
      last_audio_reset_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `;

  // Execute the SQL to create tables
  const dbInstance = db.$client;
  dbInstance.exec(createTablesSQL);

  try {
    dbInstance.exec('ALTER TABLE users ADD COLUMN password_hash TEXT;');
  } catch (error: any) {
    if (!error.message?.includes('duplicate column name')) {
      throw error;
    }
  }

  console.log('Database tables created successfully!');
}

async function seedQuotes() {
  // Check if we have enough quotes (should be 174 or more)
  const existingQuotesCount = await db.$count(schema.quotes);
  console.log(`Found ${existingQuotesCount} existing quotes`);

  if (existingQuotesCount >= 170) {
    console.log('Quotes already fully seeded, checking for null IDs...');
    // Fix quotes with null IDs
    const quotesWithNullId = await db.select().from(schema.quotes).where(eq(schema.quotes.id, null));
    if (quotesWithNullId.length > 0) {
      console.log(`Found ${quotesWithNullId.length} quotes with null IDs, fixing...`);
      for (const quote of quotesWithNullId) {
        await db.update(schema.quotes)
          .set({ id: createId() })
          .where(eq(schema.quotes.text, quote.text)); // Use text as unique identifier
      }
      console.log('Null IDs fixed successfully!');
    }
    return;
  }

  // Clear existing quotes and re-seed if we have too few
  if (existingQuotesCount > 0) {
    console.log('Clearing existing quotes due to insufficient count...');
    await db.delete(schema.quotes);
  }

  const defaultQuotes = [
    { text: "Единственный способ сделать что-то хорошо — полюбить то, что вы делаете.", author: "Стив Джобс", category: "Мотивация" },
    { text: "Жизнь — это то, что происходит с вами, пока вы строите другие планы.", author: "Джон Леннон", category: "Жизнь" },
    { text: "Путь в тысячу миль начинается с первого шага.", author: "Лао-цзы", category: "Начинания" },
    { text: "Не важно, как медленно вы идете, главное — не останавливаться.", author: "Конфуций", category: "Настойчивость" },
    { text: "Счастье — это не цель, а способ жить.", author: "Далай-лама", category: "Счастье" },
    { text: "Будьте тем изменением, которое хотите видеть в мире.", author: "Махатма Ганди", category: "Вдохновение" },
    { text: "Лучшее время посадить дерево было 20 лет назад. Второе лучшее время — сейчас.", author: "Китайская пословица", category: "Действие" },
    { text: "Успех — это способность идти от неудачи к неудаче, не теряя энтузиазма.", author: "Уинстон Черчилль", category: "Успех" },
    { text: "Ваше время ограничено, не тратьте его на жизнь чужой жизнью.", author: "Стив Джобс", category: "Аутентичность" },
    { text: "Единственная невозможная вещь — это та, которую вы не пытались сделать.", author: "Неизвестный автор", category: "Возможности" },
    { text: "Падать — это нормально. Подниматься — обязательно.", author: "Конфуций", category: "Стойкость" },
    { text: "Мудрость приходит с опытом, а опыт — с ошибками.", author: "Оскар Уайльд", category: "Мудрость" },
    { text: "Сила не в том, чтобы никогда не падать, а в том, чтобы подниматься каждый раз.", author: "Нельсон Мандела", category: "Стойкость" },
    { text: "Каждый день — новый шанс изменить свою жизнь.", author: "Неизвестный автор", category: "Начинания" },
    { text: "Когда вы говорите «да» другим, убедитесь, что не говорите «нет» себе.", author: "Пауло Коэльо", category: "Баланс" },
    { text: "Вдохновение существует, но оно приходит во время работы.", author: "Пабло Пикассо", category: "Творчество" },
    { text: "Чтобы быть незаменимым, нужно быть неповторимым.", author: "Коко Шанель", category: "Аутентичность" },
    { text: "Люди видят мир не таким, какой он есть, а такими, какие они сами.", author: "Альбер Камю", category: "Осознанность" },
    { text: "Свобода — это ответственность.", author: "Жан-Поль Сартр", category: "Ответственность" },
    { text: "Если хочешь иметь то, чего никогда не имел, сделай то, чего никогда не делал.", author: "Томас Джефферсон", category: "Действие" },
    { text: "Мечты сбываются у тех, кто их преследует.", author: "Неизвестный автор", category: "Мотивация" },
    { text: "Если проблема решаема, то не стоит о ней беспокоиться. Если не решаема — беспокоиться бесполезно.", author: "Далай-лама", category: "Мудрость" },
    { text: "Характер формируется не в легкие времена, а в испытаниях.", author: "Неизвестный автор", category: "Стойкость" },
    { text: "Никогда не поздно стать тем, кем ты мог бы быть.", author: "Джордж Элиот", category: "Начинания" },
    { text: "Куда бы ты ни шел, иди всем сердцем.", author: "Конфуций", category: "Осознанность" },
    { text: "Сомнения убивают больше мечтаний, чем неудачи.", author: "Сьюзи Кассем", category: "Возможности" },
    { text: "Мы становимся тем, о чем думаем большую часть времени.", author: "Эрл Найтингейл", category: "Мышление" },
    { text: "Победа — это состояние духа.", author: "Неизвестный автор", category: "Успех" },
    { text: "Не сравнивай себя ни с кем. Сравни себя с собой вчерашним.", author: "Неизвестный автор", category: "Саморазвитие" },
    { text: "Быть счастливым не значит иметь всё, что хочешь, а значит уметь радоваться тому, что есть.", author: "Неизвестный автор", category: "Счастье" },
    { text: "Ошибки — это доказательство того, что вы пытаетесь.", author: "Неизвестный автор", category: "Мотивация" },
    { text: "Настоящее богатство — это возможность жить так, как хочется.", author: "Генри Дэвид Торо", category: "Свобода" },
    { text: "Когда ты изменишься, все вокруг изменится.", author: "Неизвестный автор", category: "Осознанность" },
    { text: "Человек, который никогда не совершал ошибок, никогда не пробовал ничего нового.", author: "Альберт Эйнштейн", category: "Творчество" },
    { text: "Спокойствие — это не отсутствие эмоций, а управление ими.", author: "Неизвестный автор", category: "Осознанность" },
    { text: "Уважайте себя настолько, чтобы уйти от всего, что вам не служит.", author: "Неизвестный автор", category: "Самоуважение" },
    { text: "Мы не можем контролировать ветер, но можем настроить паруса.", author: "Неизвестный автор", category: "Гибкость" },
    { text: "Иногда нужно отойти в сторону, чтобы увидеть дорогу впереди.", author: "Неизвестный автор", category: "Осознанность" },
    { text: "Там, где есть любовь, есть жизнь.", author: "Махатма Ганди", category: "Любовь" },
    { text: "Ваши мысли определяют вашу реальность.", author: "Неизвестный автор", category: "Мышление" },
    { text: "Каждый человек — архитектор своей судьбы.", author: "Аппий Клавдий", category: "Ответственность" },
    { text: "Счастье — это направление, а не место.", author: "Сидни Харрис", category: "Счастье" },
    { text: "У вас есть все, что нужно, чтобы справиться с любым вызовом.", author: "Неизвестный автор", category: "Саморазвитие" },
    { text: "Учитесь отдыхать, а не сдаваться.", author: "Неизвестный автор", category: "Баланс" },
    { text: "Ваша сила — в вашем выборе.", author: "Неизвестный автор", category: "Ответственность" },
    { text: "Не бойтесь говорить «нет», если это охраняет ваш внутренний мир.", author: "Неизвестный автор", category: "Границы" },
    { text: "Любое путешествие начинается с решения сделать первый шаг.", author: "Неизвестный автор", category: "Начинания" },
    { text: "Тише едешь — дальше будешь.", author: "Русская пословица", category: "Осознанность" },
    { text: "Если хочешь идти быстро — иди один. Если хочешь идти далеко — идите вместе.", author: "Африканская пословица", category: "Отношения" },
    { text: "Мы привлекаем то, чем являемся.", author: "Неизвестный автор", category: "Мышление" },
    { text: "Видимая сила — это отражение внутренней силы.", author: "Неизвестный автор", category: "Саморазвитие" },
    { text: "Любите себя за путь, а не только за достижения.", author: "Неизвестный автор", category: "Самоуважение" },
    { text: "Умение слушать — это начало понимания.", author: "Неизвестный автор", category: "Осознанность" },
    { text: "Настоящий успех — это умение быть довольным собой.", author: "Неизвестный автор", category: "Успех" },
    { text: "Не ждите идеального момента. Сделайте момент идеальным.", author: "Неизвестный автор", category: "Мотивация" },
    { text: "Терпение — это не умение ждать, а умение сохранять хорошее настроение в ожидании.", author: "Неизвестный автор", category: "Настойчивость" },
    { text: "Улыбка — это универсальный ключ к добрым отношениям.", author: "Неизвестный автор", category: "Отношения" },
    { text: "Чтобы изменить мир, начни с себя.", author: "Лев Толстой", category: "Вдохновение" },
    { text: "Жизнь начинается там, где заканчивается зона комфорта.", author: "Нил Доналд Уолш", category: "Начинания" },
    { text: "Вы не можете вернуться и изменить начало, но можете начать сейчас и изменить конец.", author: "К. С. Льюис", category: "Начинания" },
    { text: "Иногда молчание — лучший ответ.", author: "Далай-лама", category: "Осознанность" },
    { text: "Забота о себе — это не эгоизм, а необходимость.", author: "Неизвестный автор", category: "Забота о себе" },
    { text: "Кто хочет — ищет возможности, кто не хочет — ищет причины.", author: "Аристотель", category: "Ответственность" },
    { text: "Мыслим — значит существуем.", author: "Рене Декарт", category: "Мышление" },
    { text: "Смелость — это мастерство начать.", author: "Неизвестный автор", category: "Смелость" },
    { text: "Кратчайший путь к себе — через честность.", author: "Неизвестный автор", category: "Аутентичность" },
    { text: "Цени моменты, они никогда не повторятся.", author: "Неизвестный автор", category: "Осознанность" },
    { text: "Когда одна дверь закрывается, открывается другая.", author: "Александр Белл", category: "Надежда" },
    { text: "Секрет счастья — в маленьких радостях.", author: "Неизвестный автор", category: "Счастье" },
    { text: "Не смотри назад — ты туда не идешь.", author: "Неизвестный автор", category: "Мотивация" },
    { text: "Делайте то, что можете, с тем, что имеете, там, где вы есть.", author: "Теодор Рузвельт", category: "Ответственность" },
    { text: "Сила улыбки в том, что она может изменить день.", author: "Неизвестный автор", category: "Счастье" },
    { text: "Тот, кто светит, никогда не оставляет других в темноте.", author: "Неизвестный автор", category: "Вдохновение" },
    { text: "В тысяче миль пути самое важное — первый шаг.", author: "Неизвестный автор", category: "Начинания" },
    { text: "Настоящий друг — тот, кто видит боль в твоих глазах, когда все верят твоей улыбке.", author: "Неизвестный автор", category: "Отношения" },
    { text: "Будь таким человеком, которого хотел бы встретить.", author: "Неизвестный автор", category: "Саморазвитие" },
    { text: "Всё, что мы есть — результат наших мыслей.", author: "Будда", category: "Мышление" },
    { text: "Благодарность превращает то, что мы имеем, в достаток.", author: "Неизвестный автор", category: "Благодарность" },
    { text: "Удивительное начинается там, где заканчивается привычное.", author: "Неизвестный автор", category: "Творчество" },
    { text: "Ты сильнее, чем тебе кажется.", author: "Неизвестный автор", category: "Сила" },
    { text: "Научись слушать тишину, и ты услышишь себя.", author: "Неизвестный автор", category: "Осознанность" },
    { text: "Не сравнивайте свое начало с серединой чужого пути.", author: "Неизвестный автор", category: "Саморазвитие" },
    { text: "Иногда лучшая реакция — ничто.", author: "Неизвестный автор", category: "Границы" },
    { text: "Доверяйте процессу, даже если сейчас он непонятен.", author: "Неизвестный автор", category: "Надежда" },
    { text: "Тишина учит нас слушать собственное сердце.", author: "Неизвестный автор", category: "Осознанность" },
    { text: "В спокойствии есть сила.", author: "Неизвестный автор", category: "Сила" },
    { text: "Будь мягким, но не позволяй себя ломать.", author: "Неизвестный автор", category: "Границы" },
    { text: "Отпусти то, что не дает расти.", author: "Неизвестный автор", category: "Освобождение" },
    { text: "Ищите свет внутри себя, и вы найдёте его в мире.", author: "Неизвестный автор", category: "Вдохновение" },
    { text: "Покой — это высшая форма счастья.", author: "Неизвестный автор", category: "Счастье" },
    { text: "Когда твое сердце полно, оно само знает путь.", author: "Неизвестный автор", category: "Осознанность" },
    { text: "Не торопи себя. У каждого цветка своё время расцвести.", author: "Неизвестный автор", category: "Терпение" },
    { text: "Доброта — язык, который понятен каждому.", author: "Неизвестный автор", category: "Отношения" },
    { text: "Вера в себя превращает невидимое в видимое.", author: "Неизвестный автор", category: "Саморазвитие" },
    { text: "Движение вперед начинается с честного взгляда внутрь.", author: "Неизвестный автор", category: "Осознанность" },
    { text: "Не бойся изменений — они приводят к росту.", author: "Неизвестный автор", category: "Начинания" },
    { text: "Ты — автор истории своей жизни. Пиши её осознанно.", author: "Неизвестный автор", category: "Ответственность" },
    { text: "То, что ты ищешь, тоже ищет тебя.", author: "Руми", category: "Надежда" },
    { text: "Всё, что приходит, — к лучшему, даже если сейчас это неочевидно.", author: "Неизвестный автор", category: "Надежда" },
    { text: "Умение отдыхать — часть умения достигать.", author: "Неизвестный автор", category: "Баланс" },
    { text: "У каждого шторма есть конец.", author: "Неизвестный автор", category: "Надежда" },
    { text: "Быть собой — значит быть свободным.", author: "Неизвестный автор", category: "Аутентичность" },
    { text: "Внутренняя тишина — источник силы.", author: "Неизвестный автор", category: "Сила" },
    { text: "Сохраняй спокойствие. Ты уже пережил 100% своих худших дней.", author: "Неизвестный автор", category: "Стойкость" },
    { text: "Слова лечат, когда они искренни.", author: "Неизвестный автор", category: "Отношения" },
    { text: "Поддерживайте тех, кто поддерживает вас.", author: "Неизвестный автор", category: "Отношения" },
    { text: "В каждом дне есть что-то хорошее. Найдите это.", author: "Неизвестный автор", category: "Благодарность" },
    { text: "Смелость — это страх, который прочитал молитву.", author: "Неизвестный автор", category: "Смелость" },
    { text: "Уберите из жизни шум, и услышите свою мудрость.", author: "Неизвестный автор", category: "Осознанность" },
    { text: "Выбирайте людей, рядом с которыми становится легко дышать.", author: "Неизвестный автор", category: "Отношения" },
    { text: "Никто не сможет полить ваш сад, если вы сами не возьмётесь за лейку.", author: "Неизвестный автор", category: "Саморазвитие" },
    { text: "Принятие — это дверь к спокойствию.", author: "Неизвестный автор", category: "Осознанность" },
    { text: "Когда вы научитесь выбирать себя, вы перестанете бояться одиночества.", author: "Неизвестный автор", category: "Самоуважение" },
    { text: "Смена перспективы приносит новые решения.", author: "Неизвестный автор", category: "Мышление" },
    { text: "Побеждает тот, кто победил себя.", author: "Неизвестный автор", category: "Саморазвитие" },
    { text: "Жизнь — это не ожидание бурь, а умение танцевать под дождем.", author: "Вивьен Грин", category: "Баланс" },
    { text: "Отпусти ожидания, и ты увидишь реальность.", author: "Неизвестный автор", category: "Осознанность" },
    { text: "Не позволяй вчерашним ошибкам жить в твоём сегодня.", author: "Неизвестный автор", category: "Прошлое" },
    { text: "Сострадание начинается с себя.", author: "Неизвестный автор", category: "Забота о себе" },
    { text: "Слышать сердцем — значит чувствовать глубже.", author: "Неизвестный автор", category: "Осознанность" },
    { text: "Любовь к себе — самый верный компас.", author: "Неизвестный автор", category: "Самоуважение" },
    { text: "Насколько далеко вы уйдёте, зависит от того, что вы решите оставить позади.", author: "Неизвестный автор", category: "Освобождение" },
    { text: "Там, где есть жизнь, есть надежда.", author: "Маркус Туллий Цицерон", category: "Надежда" },
    { text: "Умейте делать паузы между мыслями — там живёт ясность.", author: "Неизвестный автор", category: "Осознанность" },
    { text: "Свет в конце тоннеля — не мираж, если ты продолжаешь идти.", author: "Неизвестный автор", category: "Настойчивость" },
    { text: "Сила характера — в мягкости сердца.", author: "Неизвестный автор", category: "Саморазвитие" },
    { text: "Чтобы прийти куда-то, нужно перестать бояться идти.", author: "Неизвестный автор", category: "Смелость" },
    { text: "Люби усилие, а не результат.", author: "Неизвестный автор", category: "Мышление" },
    { text: "Доверься времени, оно лечит лучше любых слов.", author: "Неизвестный автор", category: "Надежда" },
    { text: "Вы — то, что вы делаете каждый день.", author: "Аристотель", category: "Привычки" },
    { text: "Лучший способ предсказать будущее — создать его.", author: "Питер Друкер", category: "Ответственность" },
    { text: "Смелость быть собой — самый красивый выбор.", author: "Неизвестный автор", category: "Аутентичность" },
    { text: "Не держите в себе чувства — они становятся грузом.", author: "Неизвестный автор", category: "Освобождение" },
    { text: "Ни одна ночь не длится вечно.", author: "Неизвестный автор", category: "Надежда" },
    { text: "Запишите свои мысли — так они перестанут быть хаосом.", author: "Неизвестный автор", category: "Практики" },
    { text: "Ваша история уже вдохновляет — просто продолжайте.", author: "Неизвестный автор", category: "Вдохновение" },
    { text: "Мир реагирует на вашу внутреннюю гармонию.", author: "Неизвестный автор", category: "Осознанность" },
    { text: "Иногда нужно расплакаться, чтобы освободить место для улыбки.", author: "Неизвестный автор", category: "Эмоции" },
    { text: "Сначала примите себя, потом улучшайте.", author: "Неизвестный автор", category: "Саморазвитие" },
    { text: "Прислушайтесь к паузам — в них ответы.", author: "Неизвестный автор", category: "Осознанность" },
    { text: "Спокойный ум — лучшая защита от хаоса.", author: "Неизвестный автор", category: "Сила" },
    { text: "Не нужно спешить. Нужно быть, чувствовать и понимать.", author: "Неизвестный автор", category: "Осознанность" },
    { text: "Там, где есть искренность, есть доверие.", author: "Неизвестный автор", category: "Отношения" },
    { text: "Ищите радость в простом, и она станет вашей привычкой.", author: "Неизвестный автор", category: "Счастье" },
    { text: "«Самый лучший способ предсказать будущее — создать его».", author: "Питер Друкер", category: "Лидерство" },
    { text: "«Успех — это способность двигаться от неудачи к неудаче, не теряя энтузиазма».", author: "Уинстон Черчилль", category: "Успех" },
    { text: "«Мы — это то, что делаем постоянно. Совершенство — не действие, а привычка».", author: "Аристотель", category: "Привычки" },
    { text: "«Дорогу осилит идущий».", author: "Овидий", category: "Настойчивость" },
    { text: "«Когда есть “зачем”, можно выдержать почти любое “как”».", author: "Виктор Франкл", category: "Смысл" },
    { text: "«Всё, что нас не убивает, делает нас сильнее».", author: "Фридрих Ницше", category: "Стойкость" },
    { text: "«Ваше время ограничено, не тратьте его, живя чужой жизнью».", author: "Стив Джобс", category: "Аутентичность" },
    { text: "«Жизнь — это то, что с нами происходит, пока мы строим другие планы».", author: "Джон Леннон", category: "Осознанность" },
    { text: "«Гений — это один процент вдохновения и девяносто девять процентов пота».", author: "Томас Эдисон", category: "Труд" },
    { text: "«Стань изменением, которое хочешь увидеть в мире».", author: "Махатма Ганди", category: "Вдохновение" },
    { text: "«Никогда не поздно стать тем, кем мог бы быть».", author: "Джордж Элиот", category: "Саморазвитие" },
    { text: "«Мы становимся тем, о чём думаем большую часть времени».", author: "Эрл Найтингейл", category: "Мышление" },
    { text: "«Большинство людей тратит больше сил на обход трудностей, чем на их преодоление».", author: "Генри Форд", category: "Настойчивость" },
    { text: "«То, кем вы станете, гораздо важнее того, что вы получите».", author: "Джим Рон", category: "Ценности" },
    { text: "«Тот, кто хочет — ищет возможности; тот, кто не хочет — ищет причины».", author: "Наполеон Бонапарт", category: "Ответственность" },
    { text: "«Судьба человека — в его собственном характере».", author: "Геродот", category: "Характер" },
    { text: "«Счастье — это когда то, что ты думаешь, говоришь и делаешь, находится в гармонии».", author: "Махатма Ганди", category: "Счастье" },
    { text: "«Не бойтесь совершенства. Вам его не достичь».", author: "Сальвадор Дали", category: "Саморазвитие" },
    { text: "«Человек велик не тем, что он имеет, а тем, что он даёт».", author: "Виктор Гюго", category: "Щедрость" },
    { text: "«Все думают изменить мир, но никто не думает изменить себя».", author: "Лев Толстой", category: "Саморазвитие" },
    { text: "«Красноречивее всего о человеке говорит то, над чем он смеётся».", author: "Иоганн Вольфганг Гёте", category: "Мышление" },
    { text: "«Мужество — это сопротивление страху, контроль над страхом, а не отсутствие страха».", author: "Марк Твен", category: "Смелость" },
    { text: "«Цель жизни — не в том, чтобы быть на стороне большинства, а в том, чтобы жить согласно своему пониманию долга».", author: "Марк Аврелий", category: "Ценности" },
    { text: "«Сначала мы формируем привычки, затем привычки формируют нас».", author: "Джон Драйден", category: "Привычки" },
    { text: "«Инвестиции в знания приносят наибольший доход».", author: "Бенджамин Франклин", category: "Обучение" },
    { text: "«Если вы думаете, что образование дорого, попробуйте невежество».", author: "Дерек Бок", category: "Обучение" },
    { text: "«Ничего великого нельзя достигнуть без страсти».", author: "Георг Гегель", category: "Вдохновение" },
    { text: "«Лишь тот, кто берёт на себя ответственность, может быть свободным».", author: "Фридрих фон Хайек", category: "Свобода" },
    { text: "«Если ты рожден без крыльев — не мешай им расти».", author: "Коко Шанель", category: "Аутентичность" },
    { text: "«Самый трудный шаг — решиться действовать, остальное — только вопрос настойчивости».", author: "Амелия Эрхарт", category: "Смелость" }
  ];

  for (const quote of defaultQuotes) {
    await db.insert(schema.quotes).values({
      id: createId(), // Явно генерируем ID
      ...quote,
      createdAt: new Date(),
    });
  }

  console.log('Quotes seeded successfully!');
}

async function createDefaultUser() {
  // Check if default user exists
  const existingUser = await db.select().from(schema.users).where(eq(schema.users.email, 'user@zenmindmate.com')).limit(1);

  if (existingUser.length > 0) {
    console.log('Default user already exists, skipping...');
    return;
  }

  const now = new Date();

  // Create default user
  const [user] = await db.insert(schema.users).values({
    name: 'Пользователь',
    email: 'user@zenmindmate.com',
    createdAt: now,
    updatedAt: now,
  }).returning();

  // Create user stats
  await db.insert(schema.userStats).values({
    userId: user.id,
    createdAt: now,
    updatedAt: now,
  });

  console.log('Default user created successfully!');
}
