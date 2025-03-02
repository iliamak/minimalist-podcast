# Реализация прокси для аудиофайлов на Vercel

## Проблема

При разработке приложения для подкастов мы столкнулись с ограничениями CORS (Cross-Origin Resource Sharing) при попытке получить доступ к аудиоданным для визуализации звуковых волн. В частности, при использовании Web Audio API для создания `MediaElementAudioSource` возникала следующая ошибка:

```
MediaElementAudioSource outputs zeroes due to CORS access restrictions for https://media.transistor.fm/...
```

Это происходит потому, что:

1. Большинство серверов подкастов не имеют настроенных CORS-заголовков, разрешающих доступ к данным из других доменов.
2. Web Audio API требует, чтобы внешние аудиофайлы имели правильно настроенные CORS-заголовки.
3. Простое использование атрибута `crossOrigin="anonymous"` недостаточно, если сервер не поддерживает CORS.

## Решение: собственный прокси на Vercel

Вместо использования внешних прокси-сервисов (которые могут иметь ограничения или быть ненадежными), мы реализовали собственный CORS-прокси непосредственно в нашем приложении с использованием Vercel API Routes.

### Шаг 1: Создание API Route

Мы создали файл `api/proxy.js` со следующими функциями:

- Принимает URL аудиофайла в качестве параметра запроса
- Выполняет запрос к этому URL на стороне сервера (где нет CORS-ограничений)
- Возвращает содержимое аудиофайла с правильными CORS-заголовками

```javascript
// api/proxy.js
export default async function handler(req, res) {
  try {
    const url = req.query.url;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Proxy request failed with status ${response.status}` 
      });
    }
    
    const contentType = response.headers.get('content-type');
    const arrayBuffer = await response.arrayBuffer();
    
    res.setHeader('Content-Type', contentType || 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 часа кэширования
    
    res.status(200).send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy server error' });
  }
}
```

### Шаг 2: Настройка Vercel

Для правильной работы API Routes мы добавили файл `vercel.json`:

```json
{
  "version": 2,
  "routes": [
    {
      "src": "/api/proxy",
      "dest": "/api/proxy.js",
      "methods": ["GET"]
    }
  ],
  "headers": [
    {
      "source": "/api/proxy",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET"
        }
      ]
    }
  ]
}
```

### Шаг 3: Использование прокси в Web Audio API

В файле `script.js` мы изменили логику инициализации аудиоконтекста:

```javascript
const AUDIO_PROXY_URL = '/api/proxy?url=';

function initAudioContext() {
  // ...
  
  // Получаем URL текущего аудио
  const originalAudioUrl = audioPlayer.src;
  
  // Проксируем через наш Vercel API
  const proxiedUrl = AUDIO_PROXY_URL + encodeURIComponent(originalAudioUrl);
  
  // Используем проксированный URL для анализа аудиоданных
  const audioElement = new Audio(proxiedUrl);
  audioElement.crossOrigin = 'anonymous';
  
  // ...
}
```

## Преимущества решения

1. **Надежность**: мы не зависим от внешних сервисов прокси.
2. **Производительность**: Vercel API Routes работают быстро и с низкой задержкой.
3. **Масштабируемость**: решение масштабируется вместе с приложением.
4. **Кэширование**: мы используем HTTP-кэширование для снижения нагрузки.
5. **Полный контроль**: мы можем настроить прокси под наши конкретные нужды.

## Запасной вариант

Мы также реализовали улучшенный запасной вариант визуализации для случаев, когда прокси не может быть использован:

```javascript
function startFakeVisualization() {
  // Улучшенная имитация визуализации аудио...
}
```

## Развертывание

Поскольку это экспериментальная функция, мы разместили её в отдельной ветке `feature/vercel-proxy`. Для развертывания на Vercel:

1. Клонировать репозиторий
2. Переключиться на ветку: `git checkout feature/vercel-proxy`
3. Развернуть на Vercel через GitHub интеграцию или CLI
