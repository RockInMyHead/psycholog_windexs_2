
// Проверяем поддержку Web Speech API
if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
  console.log("✅ Web Speech API поддерживается");
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  
  console.log("✅ SpeechRecognition создан");
  console.log("✅ Язык по умолчанию:", recognition.lang);
  
  recognition.onstart = () => console.log("✅ Распознавание запущено");
  recognition.onerror = (e) => console.error("❌ Ошибка распознавания:", e.error);
  recognition.onend = () => console.log("✅ Распознавание завершено");
  
  // Пробуем запустить на короткое время
  recognition.start();
  setTimeout(() => recognition.stop(), 1000);
  
} else {
  console.error("❌ Web Speech API не поддерживается");
}

