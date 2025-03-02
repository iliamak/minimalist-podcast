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

// Переменные для хранения данных
let podcasts = JSON.parse(localStorage.getItem('podcasts')) || [];
let currentPodcast = null;
let currentEpisode = null;

// Инициализация страницы
init();

// Функция инициализации
function init() {
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
    });
    
    audioPlayer.addEventListener('pause', () => {
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
    });
    
    audioPlayer.addEventListener('ended', () => {
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        progress.style.width = '0%';
        currentTimeEl.textContent = '0:00';
    });
}

// Функция для добавления подкаста
async function addPodcast() {
    const rssUrl = rssInput.value.trim();
    if (!rssUrl) {
        alert('Пожалуйста, введите URL RSS-ленты');
        return;
    }
    
    try {
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
        const imageUrl = channel.querySelector('image > url')?.textContent || 'default-avatar.png';
        
        // Извлечение эпизодов
        const items = xml.querySelectorAll('item');
        const episodes = Array.from(items).map(item => {
            const title = item.querySelector('title').textContent;
            const description = item.querySelector('description')?.textContent || '';
            const pubDate = item.querySelector('pubDate')?.textContent || '';
            const enclosure = item.querySelector('enclosure');
            const audioUrl = enclosure?.getAttribute('url') || '';
            
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
    } catch (error) {
        console.error('Ошибка при добавлении подкаста:', error);
        alert('Ошибка при добавлении подкаста. Пожалуйста, проверьте URL и попробуйте снова.');
    }
}

// Функция для отображения списка подкастов
function renderPodcasts() {
    podcastsContainer.innerHTML = '';
    
    if (podcasts.length === 0) {
        podcastsContainer.innerHTML = '<p>Нет добавленных подкастов</p>';
        return;
    }
    
    podcasts.forEach(podcast => {
        const podcastItem = document.createElement('li');
        podcastItem.className = 'podcast-item';
        if (currentPodcast && currentPodcast.id === podcast.id) {
            podcastItem.classList.add('active');
        }
        
        podcastItem.textContent = podcast.title;
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
    currentPodcastTitle.textContent = podcast.title;
    currentEpisodeTitle.textContent = 'Выберите эпизод';
}

// Функция для отображения списка эпизодов
function renderEpisodes(episodes) {
    episodesContainer.innerHTML = '';
    
    if (episodes.length === 0) {
        episodesContainer.innerHTML = '<p>Нет доступных эпизодов</p>';
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
        if (description.textContent.length > 150) {
            description.textContent = description.textContent.substring(0, 150) + '...';
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
    audioPlayer.src = episode.audioUrl;
    audioPlayer.play();
    
    currentEpisodeTitle.textContent = episode.title;
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

// Пример подкаста для тестирования (можно раскомментировать, чтобы добавить его автоматически)
/*
setTimeout(() => {
    rssInput.value = 'https://feeds.simplecast.com/54nAGcIl'; // Пример: подкаст "The Daily" от The New York Times
    addPodcastBtn.click();
}, 1000);
*/
