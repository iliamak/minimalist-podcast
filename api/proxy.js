// Простой прокси-сервер для обхода CORS ограничений
export default async function handler(req, res) {
  try {
    // Получаем URL из параметров запроса
    const url = req.query.url;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    // Выполняем запрос к указанному URL
    const response = await fetch(url);
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Proxy request failed with status ${response.status}` 
      });
    }
    
    // Получаем заголовки для определения Content-Type
    const contentType = response.headers.get('content-type');
    
    // Получаем данные как ArrayBuffer
    const arrayBuffer = await response.arrayBuffer();
    
    // Устанавливаем правильные заголовки
    res.setHeader('Content-Type', contentType || 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Кэширование на 24 часа
    
    // Отправляем данные
    res.status(200).send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy server error' });
  }
}
