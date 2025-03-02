// Основные элементы DOM
const rssInput = document.getElementById('rss-input');
const addPodcastBtn = document.getElementById('add-podcast-btn');
const podcastsContainer = document.getElementById('podcasts-container');
const episodesContainer = document.getElementById('episodes-container');
const audioPlayer = document.getElementById('audio-player');
const playBtn = document.getElementById('play-btn');
const back15Btn = document.getElementById('back-15-btn');
const forward15Btn = document.getElementById('forward-15-btn');
const progress = document.getElementById('progress');
const progressBar = document.querySelector('.progress-bar');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');
const currentPodcastImg = document.getElementById('current-podcast-img');
const currentPodcastTitle = document.getElementById('current-podcast-title');
const currentEpisodeTitle = document.getElementById('current-episode-title');
const donateBtn = document.getElementById('donate-btn');
const waveContainer = document.getElementById('wave-container');
const waveElement = document.getElementById('wave');

// Константы для работы с прокси
const CORS_PROXY_URL = 'https://api.allorigins.win/raw?url=';

// Переменные для хранения данных
let podcasts = JSON.parse(localStorage.getItem('podcasts')) || [];
let currentPodcast = null;
let currentEpisode = null;
let audioContext = null;
let audioSource = null;
let analyser = null;
let waveBars = [];
let animationFrameId = null;

// Инициализация страницы
init();

// Функция инициализации
function init() {
    // Создание волновых элементов для визуализации
    createWaveElements();
    
    // Отображение сохраненных подкастов
    renderPodcasts();
    
    // Настройка обработчиков событий
    addPodcastBtn.addEventListener('click', addPodcast);
    playBtn.addEventListener('click', togglePlay);
    back15Btn.addEventListener('click', () => skipTime(-15));
    forward15Btn.addEventListener('click', () => skipTime(15));
    audioPlayer.addEventListener('timeupdate', updateProgress);
    audioPlayer.addEventListener('loadedmetadata', setDuration);
    progressBar.addEventListener('click', setProgress);
    donateBtn.addEventListener('click', openDonateLink);
    
    // Настройка событий аудиоплеера
    audioPlayer.addEventListener('play', () => {
        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
        initAudioContext();
        startVisualization();
    });
    
    audioPlayer.addEventListener('pause', () => {
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        stopVisualization();
    });
    
    audioPlayer.addEventListener('ended', () => {
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        progress.style.width = '0%';
        currentTimeEl.textContent = '0:00';
        stopVisualization();
        resetWaveVisualizer();
    });
}

// Создание элементов для визуализации волн
function createWaveElements() {
    waveElement.innerHTML = '';
    const barsCount = 32; // Количество полосок
    
    for (let i = 0; i < barsCount; i++) {
        const bar = document.createElement('div');
        bar.className = 'wave-bar';
        waveElement.appendChild(bar);
        waveBars.push(bar);
    }
    
    // Инициализация с случайными начальными значениями для пустой визуализации
    resetWaveVisualizer();
}

// Сброс визуализатора волн до состояния покоя
function resetWaveVisualizer() {
    waveBars.forEach(bar => {
        const randomHeight = 5 + Math.random() * 15;
        bar.style.height = `${randomHeight}px`;
    });
}

// Инициализация аудио контекста для визуализации
function initAudioContext() {
    if (!audioContext) {
        try {
            // Создаем новый аудиоконтекст
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 64;
            
            // Создаем временный аудиоэлемент для обхода CORS
            const tempAudio = new Audio();
            tempAudio.crossOrigin = 'anonymous';
            
            // Используем текущий src аудиоплеера, но через прокси
            let audioUrl = audioPlayer.src;
            
            // Проверяем, не проксирован ли URL уже
            if (!audioUrl.includes('allorigins.win') && !audioUrl.includes('cors-anywhere')) {
                // Проксируем URL через CORS прокси
                audioUrl = CORS_PROXY_URL + encodeURIComponent(audioUrl);
            }
            
            tempAudio.src = audioUrl;
            
            // Подключаем временный аудиоэлемент к аудиоконтексту
            audioSource = audioContext.createMediaElementSource(tempAudio);
            audioSource.connect(analyser);
            analyser.connect(audioContext.destination);
            
            // Синхронизируем воспроизведение с основным плеером
            tempAudio.currentTime = audioPlayer.currentTime;
            if (!audioPlayer.paused) {
                tempAudio.play().catch(error => {
                    console.error('Ошибка при воспроизведении аудио через прокси:', error);
                    // Если не удалось воспроизвести с прокси, используем имитацию визуализации
                    startFakeVisualization();
                });
            }
            
            // Обновляем обработчики событий для синхронизации временного аудио с основным
            audioPlayer.addEventListener('play', () => {
                if (tempAudio.paused) {
                    tempAudio.play().catch(error => {
                        console.error('Ошибка при воспроизведении:', error);
                    });
                }
            });
            
            audioPlayer.addEventListener('pause', () => {
                tempAudio.pause();
            });
            
            audioPlayer.addEventListener('timeupdate', () => {
                // Только если разница больше 0.5 секунды
                if (Math.abs(tempAudio.currentTime - audioPlayer.currentTime) > 0.5) {
                    tempAudio.currentTime = audioPlayer.currentTime;
                }
            });
            
            audioPlayer.addEventListener('seeking', () => {
                tempAudio.currentTime = audioPlayer.currentTime;
            });
            
            audioPlayer.addEventListener('ended', () => {
                tempAudio.pause();
                tempAudio.currentTime = 0;
            });
        } catch (error) {
            console.error('Ошибка при создании аудио контекста:', error);
            // Если не удалось создать аудиоконтекст, используем имитацию визуализации
            startFakeVisualization();
        }
    }
}

// Запуск визуализации
function startVisualization() {
    if (!analyser) {
        // Если аналайзер не создан, используем имитацию визуализации
        startFakeVisualization();
        return;
    }
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const updateWaveform = () => {
        analyser.getByteFrequencyData(dataArray);
        
        // Обновление высоты полосок на основе данных аудио
        for (let i = 0; i < waveBars.length; i++) {
            const index = Math.floor(bufferLength / waveBars.length * i);
            let value = dataArray[index];
            
            // Нормализация и масштабирование для лучшей визуализации
            let height = value ? 5 + (value / 255) * 70 : 5;
            waveBars[i].style.height = `${height}px`;
        }
        
        animationFrameId = requestAnimationFrame(updateWaveform);
    };
    
    updateWaveform();
}

// Имитация визуализации звуковых волн (без доступа к реальным аудиоданным)
function startFakeVisualization() {
    console.log('Используем имитацию визуализации звука');
    
    const updateFakeWaveform = () => {
        // Только если аудио воспроизводится
        if (!audioPlayer.paused) {
            for (let i = 0; i < waveBars.length; i++) {
                // Генерируем случайные значения, имитирующие активность звука
                const randomHeight = 5 + Math.random() * 50;
                waveBars[i].style.height = `${randomHeight}px`;
            }
        } else {
            // В режиме паузы - минимальная активность
            for (let i = 0; i < waveBars.length; i++) {
                const baseHeight = 5 + Math.random() * 10;
                waveBars[i].style.height = `${baseHeight}px`;
            }
        }
        
        animationFrameId = requestAnimationFrame(updateFakeWaveform);
    };
    
    updateFakeWaveform();
}

// Остановка визуализации
function stopVisualization() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

// Функция для добавления подкаста
async function addPodcast() {
    const rssUrl = rssInput.value.trim();
    if (!rssUrl) {
        alert('Пожалуйста, введите URL RSS-ленты');
        return;
    }
    
    try {
        // Анимация элемента ввода при загрузке
        rssInput.style.opacity = '0.7';
        addPodcastBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        addPodcastBtn.disabled = true;
        
        // Используем прокси для обхода CORS
        const proxyUrl = 'https://api.allorigins.win/get?url=';
        const response = await fetch(proxyUrl + encodeURIComponent(rssUrl));
        const data = await response.json();
        
        if (!data.contents) {
            throw new Error('Не удалось загрузить RSS-ленту');
        }
        
        // Парсинг XML данных RSS
        const parser = new DOMParser();
        const xml = parser.parseFromString(data.contents, 'application/xml');
        
        // Извлечение информации о подкасте
        const channel = xml.querySelector('channel');
        const title = channel.querySelector('title').textContent;
        const description = channel.querySelector('description')?.textContent || '';
        let imageUrl = '';
        
        // Ищем изображение разными способами (разные форматы RSS)
        if (channel.querySelector('image > url')) {
            imageUrl = channel.querySelector('image > url').textContent;
        } else if (channel.querySelector('itunes\\:image, image')) {
            imageUrl = channel.querySelector('itunes\\:image, image').getAttribute('href');
        } else {
            imageUrl = 'default-avatar.png';
        }
        
        // Извлечение эпизодов
        const items = xml.querySelectorAll('item');
        const episodes = Array.from(items).map(item => {
            const title = item.querySelector('title').textContent;
            const description = item.querySelector('description')?.textContent || '';
            const pubDate = item.querySelector('pubDate')?.textContent || '';
            
            // Ищем аудио ссылку разными способами
            let audioUrl = '';
            const enclosure = item.querySelector('enclosure');
            if (enclosure && enclosure.getAttribute('type')?.includes('audio')) {
                audioUrl = enclosure.getAttribute('url');
            } else if (item.querySelector('media\\:content, content')) {
                audioUrl = item.querySelector('media\\:content, content').getAttribute('url');
            }
            
            return {
                title,
                description,
                pubDate,
                audioUrl
            };
        });
        
        // Создание объекта подкаста
        const podcast = {
            id: Date.now().toString(),
            title,
            description,
            imageUrl,
            rssUrl,
            episodes
        };
        
        // Добавление подкаста в массив и сохранение
        podcasts.push(podcast);
        savePodcasts();
        
        // Отображение обновленного списка
        renderPodcasts();
        
        // Очистка поля ввода
        rssInput.value = '';
        
        // Выбор добавленного подкаста
        selectPodcast(podcast);
        
        // Добавим анимацию для нового подкаста
        const newPodcastElement = document.querySelector(`.podcast-item[data-id="${podcast.id}"]`);
        if (newPodcastElement) {
            newPodcastElement.classList.add('new-podcast');
            setTimeout(() => {
                newPodcastElement.classList.remove('new-podcast');
            }, 1000);
        }
    } catch (error) {
        console.error('Ошибка при добавлении подкаста:', error);
        alert('Ошибка при добавлении подкаста. Пожалуйста, проверьте URL и попробуйте снова.');
    } finally {
        // Сброс состояния интерфейса
        rssInput.style.opacity = '1';
        addPodcastBtn.innerHTML = 'Добавить';
        addPodcastBtn.disabled = false;
    }
}

// Функция для отображения списка подкастов
function renderPodcasts() {
    podcastsContainer.innerHTML = '';
    
    if (podcasts.length === 0) {
        podcastsContainer.innerHTML = '<p class="no-podcasts">Нет добавленных подкастов</p>';
        return;
    }
    
    podcasts.forEach(podcast => {
        const podcastItem = document.createElement('div');
        podcastItem.className = 'podcast-item';
        podcastItem.setAttribute('data-id', podcast.id);
        
        if (currentPodcast && currentPodcast.id === podcast.id) {
            podcastItem.classList.add('active');
        }
        
        // Создаем миниатюру для подкаста
        const podcastAvatar = document.createElement('div');
        podcastAvatar.className = 'podcast-avatar-mini';
        podcastAvatar.innerHTML = `<img src="${podcast.imageUrl}" alt="${podcast.title}" onerror="this.src='default-avatar.png'">`;
        
        const podcastTitle = document.createElement('div');
        podcastTitle.className = 'podcast-title-mini';
        podcastTitle.textContent = podcast.title;
        
        podcastItem.appendChild(podcastAvatar);
        podcastItem.appendChild(podcastTitle);
        
        podcastItem.addEventListener('click', () => selectPodcast(podcast));
        
        podcastsContainer.appendChild(podcastItem);
    });
}

// Функция для выбора подкаста
function selectPodcast(podcast) {
    currentPodcast = podcast;
    renderPodcasts(); // Обновляем выделение активного подкаста
    renderEpisodes(podcast.episodes);
    
    // Обновляем информацию в плеере
    currentPodcastImg.src = podcast.imageUrl;
    currentPodcastImg.onerror = () => currentPodcastImg.src = 'default-avatar.png';
    currentPodcastTitle.textContent = podcast.title;
    currentEpisodeTitle.textContent = 'Выберите эпизод';
    
    // Сбрасываем визуализатор при смене подкаста
    resetWaveVisualizer();
}

// Функция для отображения списка эпизодов
function renderEpisodes(episodes) {
    episodesContainer.innerHTML = '';
    
    if (episodes.length === 0) {
        episodesContainer.innerHTML = '<p class="no-episodes">Нет доступных эпизодов</p>';
        return;
    }
    
    episodes.forEach(episode => {
        const episodeItem = document.createElement('div');
        episodeItem.className = 'episode-item';
        
        const title = document.createElement('h3');
        title.textContent = episode.title;
        
        const description = document.createElement('p');
        // Удаляем HTML-теги из описания
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = episode.description;
        description.textContent = tempDiv.textContent || tempDiv.innerText || '';
        // Ограничиваем длину описания
        if (description.textContent.length > 120) {
            description.textContent = description.textContent.substring(0, 120) + '...';
        }
        
        const date = document.createElement('div');
        date.className = 'episode-date';
        date.textContent = formatDate(episode.pubDate);
        
        episodeItem.appendChild(title);
        episodeItem.appendChild(description);
        episodeItem.appendChild(date);
        
        episodeItem.addEventListener('click', () => playEpisode(episode));
        
        episodesContainer.appendChild(episodeItem);
    });
}

// Функция для воспроизведения эпизода
function playEpisode(episode) {
    if (!episode || !episode.audioUrl) {
        alert('Аудио файл недоступен для этого эпизода');
        return;
    }
    
    currentEpisode = episode;
    
    // Сбрасываем аудиоконтекст при смене эпизода
    if (audioContext) {
        audioContext.close().then(() => {
            audioContext = null;
            audioSource = null;
            analyser = null;
        }).catch(error => {
            console.error('Ошибка при закрытии аудиоконтекста:', error);
        });
    }
    
    // Устанавливаем аудио источник напрямую (без прокси для основного воспроизведения)
    audioPlayer.src = episode.audioUrl;
    
    // Начинаем воспроизведение
    audioPlayer.play().catch(error => {
        console.error('Ошибка воспроизведения:', error);
        alert('Не удалось воспроизвести аудио. Проверьте соединение или URL эпизода.');
    });
    
    currentEpisodeTitle.textContent = episode.title;
    
    // Выделяем активный эпизод
    document.querySelectorAll('.episode-item').forEach(item => {
        if (item.querySelector('h3').textContent === episode.title) {
            item.classList.add('active-episode');
        } else {
            item.classList.remove('active-episode');
        }
    });
}

// Функции управления плеером
function togglePlay() {
    if (!audioPlayer.src) {
        alert('Сначала выберите эпизод для прослушивания');
        return;
    }
    
    if (audioPlayer.paused) {
        audioPlayer.play();
    } else {
        audioPlayer.pause();
    }
}

function skipTime(seconds) {
    if (!audioPlayer.src) return;
    audioPlayer.currentTime += seconds;
}

function updateProgress() {
    const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progress.style.width = percent + '%';
    
    currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
}

function setDuration() {
    durationEl.textContent = formatTime(audioPlayer.duration);
}

function setProgress(e) {
    if (!audioPlayer.src) return;
    
    const width = this.clientWidth;
    const clickX = e.offsetX;
    const duration = audioPlayer.duration;
    
    audioPlayer.currentTime = (clickX / width) * duration;
}

// Вспомогательные функции
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

function formatDate(dateString) {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString();
    } catch (error) {
        return '';
    }
}

function savePodcasts() {
    localStorage.setItem('podcasts', JSON.stringify(podcasts));
}

function openDonateLink() {
    // Здесь можно настроить ссылку на страницу с донатами
    alert('Спасибо, что хотите поддержать проект! Функция донатов будет доступна в ближайшее время.');
}

// Добавляем стили для миниатюр подкастов (дополняем CSS динамически)
const style = document.createElement('style');
style.textContent = `
    .podcast-avatar-mini {
        width: 40px;
        height: 40px;
        border-radius: 20px;
        overflow: hidden;
        margin-bottom: 8px;
    }
    
    .podcast-avatar-mini img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    
    .podcast-title-mini {
        font-size: 12px;
        white-space: normal;
        word-break: break-word;
        text-align: center;
        max-width: 100px;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
    }
    
    .new-podcast {
        animation: pulse 1s ease-in-out;
    }
    
    .active-episode {
        border-color: #FFFFFF;
        box-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
    }
    
    .no-podcasts, .no-episodes {
        color: #777777;
        font-style: italic;
        text-align: center;
        padding: 20px 0;
    }
    
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
    }
`;
document.head.appendChild(style);
