import { useState, useEffect, useRef, useMemo } from 'react';
import '@splidejs/react-splide/css';
import { Splide, SplideSlide } from "@splidejs/react-splide";
import "./tiktok.css";
import { Helmet } from "react-helmet";
import { trackEvent } from '../../utils/analytics';

const TiktokCarousel = ({ videosData, username, link, country }) => {
    const [videos, setVideos] = useState([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const videoRefs = useRef([]);
    const splideRef = useRef(null);
    const [mutedStates, setMutedStates] = useState({});
    const [playingStates, setPlayingStates] = useState({});
    const [hoveredIndex, setHoveredIndex] = useState(null);
    const [isCarouselHovered, setIsCarouselHovered] = useState(false);

    const lang = useMemo(() => {
        const c = String(country || '').toLowerCase();
        if (c.startsWith('br')) return 'pt';
        const esCountries = ['es','mx','ar','co','pe','cl','uy','ve','ec','bo','py','do','cr','pa','gt','hn','sv','ni','pr'];
        if (esCountries.includes(c)) return 'es';
        return 'en';
    }, [country]);

    const i18n = useMemo(() => ({
        en: {
            pageTitle: (u) => (u ? `${u} TikTok` : "TikTok"),
            watchVideoOnTiktok: "Watch video on TikTok",
            viewsCount: (n) => `${n} views`,
            commentsCount: (n) => `${n} comments`,
            likesCount: (n) => `${n} likes`,
            play: "Play video",
            pause: "Pause video",
            enableSound: "Turn on video sound",
            mute: "Mute video",
            seeOnTiktok: "See on TikTok",
            seeProduct: "See Product",
            exploreMore: "Explore more content on TikTok",
            exploreMoreTitle: "Hikvision LATAM TikTok",
        },
        pt: {
            pageTitle: (u) => (u ? `${u} TikTok` : "TikTok"),
            watchVideoOnTiktok: "Ver vídeo no TikTok",
            viewsCount: (n) => `${n} visualizações`,
            commentsCount: (n) => `${n} comentários`,
            likesCount: (n) => `${n} curtidas`,
            play: "Reproduzir vídeo",
            pause: "Pausar vídeo",
            enableSound: "Ativar som do vídeo",
            mute: "Silenciar vídeo",
            seeOnTiktok: "Ver no TikTok",
            seeProduct: "Ver Produto",
            exploreMore: "Explorar mais conteúdo no TikTok",
            exploreMoreTitle: "TikTok Hikvision LATAM",
        },
        es: {
            pageTitle: (u) => (u ? `${u} TikTok` : "TikTok"),
            watchVideoOnTiktok: "Ver vídeo en TikTok",
            viewsCount: (n) => `${n} visualizaciones`,
            commentsCount: (n) => `${n} comentarios`,
            likesCount: (n) => `${n} me gusta`,
            play: "Reproducir vídeo",
            pause: "Pausar vídeo",
            enableSound: "Activar sonido del vídeo",
            mute: "Silenciar vídeo",
            seeOnTiktok: "Ver en TikTok",
            seeProduct: "Ver Producto",
            exploreMore: "Explora más contenido en TikTok",
            exploreMoreTitle: "Hikvision LATAM TikTok",
        }
    }), []);

    const t = (key, ...args) => {
        const dict = i18n[lang] || i18n.en;
        const val = dict[key];
        return typeof val === "function" ? val(...args) : (val ?? key);
    };

    useEffect(() => {
        if (videosData && videosData.length > 0) {
            const processed = videosData.filter(v => v.video_url);
            setVideos(processed);
        } else {
            setVideos([]);
        }
    }, [videosData]);

    useEffect(() => {
        if (videos.length > 0) {
            const initialMuted = {};
            const initialPlaying = {};
            videos.forEach((_, idx) => {
                initialMuted[idx] = true;
                initialPlaying[idx] = false;
            });
            setMutedStates(initialMuted);
            setPlayingStates(initialPlaying);
        }
    }, [videos]);

    useEffect(() => {
        videoRefs.current.forEach((video, idx) => {
            if (video) {
                video.muted = mutedStates[idx] !== false;
                if (playingStates[idx]) {
                    video.play().catch(error => {
                        console.error("Error al intentar reproducir el video:", error);
                    });
                } else {
                    video.pause();
                }
            }
        });
    }, [mutedStates, playingStates, activeIndex, videos]);

    const sendTikTokEvent = (action, video) => {
        if (window.gtag) {
            window.gtag('event', action, {
                event_category: 'Tiktok',
                event_label: video.description,
                value: video.url
            });
        }
    };

    const handleToggleMute = (idx) => {
        const isMutedNow = mutedStates[idx] !== false;
        const actionName = isMutedNow ? 'video_unmute' : 'video_mute';
        
        trackEvent('click.action', {
            click_chapter1: 'tiktok_carousel',
            click_chapter2: username,
            click_chapter3: 'video_card',
            click_name: actionName,
            video_url: videos[idx]?.url,
            video_description: videos[idx]?.description
        });

        setMutedStates((prev) => ({ ...prev, [idx]: !prev[idx] }));
        if (videos[idx]) sendTikTokEvent('toggle_mute', videos[idx]);
    };

    const handlePlayPause = (idx) => {
        const isPlayingNow = playingStates[idx];
        const actionName = isPlayingNow ? 'video_pause' : 'video_play';

        trackEvent('click.action', {
            click_chapter1: 'tiktok_carousel',
            click_chapter2: username,
            click_chapter3: 'video_card',
            click_name: actionName,
            video_url: videos[idx]?.url,
            video_description: videos[idx]?.description
        });

        setPlayingStates((prev) => {
            const newStates = {};
            Object.keys(prev).forEach((key) => {
                newStates[key] = Number(key) === idx ? !prev[idx] : false;
            });
            return newStates;
        });
        setActiveIndex(idx);

        setMutedStates((prev) => ({
            ...prev,
            [idx]: playingStates[idx] ? true : false,
        }));

        if (videos[idx]) sendTikTokEvent('play_pause', videos[idx]);
    };

    const handleVideoEnded = (idx) => {
        setPlayingStates((prev) => ({ ...prev, [idx]: false }));
        setMutedStates((prev) => ({ ...prev, [idx]: true }));
    };

    const handleCardClick = (idx, video) => {
        trackEvent('click.navigation', {
            click_chapter1: 'tiktok_carousel',
            click_chapter2: username,
            click_chapter3: 'video_card',
            click_name: 'card_click_to_tiktok',
            video_url: video.url
        });
        window.open(video.url, '_blank');
    };

    return (
        <>
            <Helmet>
                <title>{t('pageTitle', username)}</title>
            </Helmet>

            <div className="container mx-auto flex flex-col items-center justify-center min-h-screen max-w-7xl">
                <div className="w-full flex justify-center">
                    <div
                        onMouseEnter={() => setIsCarouselHovered(true)}
                        onMouseLeave={() => setIsCarouselHovered(false)}
                        className="w-full"
                        style={{ maxWidth: 1200 }}
                    >
                        <Splide
                            ref={splideRef}
                            options={{
                                type: 'slide',
                                perPage: 3,
                                focus: 'center',
                                padding: { left: '0px', right: '20%' },
                                arrows: true,
                                pagination: false,
                                autoplay: false,
                                rewind: true,
                                height: 'auto',
                                dragMinThreshold: { mouse: 120, touch: 80 },
                                speed: 600,
                                flickPower: 100,
                                flickMaxPages: 1,
                                breakpoints: {
                                    1200: { perPage: 3 },
                                    768: { perPage: 1 }
                                }
                            }}
                            onMoved={(_, newIndex) => setActiveIndex(newIndex)}
                        >
                            {videos.map((video, idx) => (
                                <SplideSlide key={video.url || idx}>
                                    <div
                                        className="flex flex-col items-center text-center video-container no-underline text-inherit relative px-2 py-4"
                                        style={{ transition: 'transform 0.4s' }}
                                    >
                                        <div
                                            className='innerVideo relative'
                                            onMouseEnter={() => setHoveredIndex(idx)}
                                            onMouseLeave={() => setHoveredIndex(null)}
                                            onClick={(e) => handleCardClick(idx, video)}
                                        >
                                            <button
                                                className="btn-mute-floating"
                                                onClick={e => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleToggleMute(idx);
                                                }}
                                                aria-label={mutedStates[idx] !== false ? t('enableSound') : t('mute')}
                                            >
                                                <i className={`text-sm ${mutedStates[idx] !== false ? "fa-solid fa-volume-xmark" : "fa-solid fa-volume-high"}`}></i>
                                            </button>

                                            <video
                                                ref={el => (videoRefs.current[idx] = el)}
                                                src={video.video_url}
                                                poster={video.thumbnail_url}
                                                loading={idx < 4 ? "eager" : "lazy"}
                                                muted={mutedStates[idx] !== false}
                                                playsInline
                                                controls={false}
                                                loop
                                                onEnded={() => handleVideoEnded(idx)}
                                                className="cursor-pointer"
                                            />

                                            <button
                                                className={`cursor-pointer btn-playpause-overlay${(hoveredIndex === idx || !playingStates[idx]) ? ' visible' : ''}`}
                                                onMouseUp={e => e.currentTarget.blur()}
                                                onClick={e => { 
                                                    e.preventDefault(); 
                                                    e.stopPropagation(); 
                                                    handlePlayPause(idx); 
                                                }}
                                                type="button"
                                                aria-label={playingStates[idx] ? t('pause') : t('play')}
                                            >
                                                <i className={`fa-solid ${playingStates[idx] ? 'fa-pause' : 'fa-play'}`}></i>
                                            </button>

                                            <div className='contentBottom'>
                                                <div className='head'>
                                                    <div className='flex items-center'>
                                                        <span className='username-tag'>
                                                            {username || "Hikvisionlatam"}
                                                        </span>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="#29b6f6" className="bi bi-patch-check-fill" viewBox="0 0 16 16">
                                                            <path d="M10.067.87a2.89 2.89 0 0 0-4.134 0l-.622.638-.89-.011a2.89 2.89 0 0 0-2.924 2.924l.01.89-.636.622a2.89 2.89 0 0 0 0 4.134l.637.622-.011.89a2.89 2.89 0 0 0 2.924 2.924l.89-.01.622.636a2.89 2.89 0 0 0 4.134 0l.622-.637.89.011a2.89 2.89 0 0 0 2.924-2.924l-.01-.89.636-.622a2.89 2.89 0 0 0 0-4.134l-.637-.622.011-.89a2.89 2.89 0 0 0-2.924-2.924l-.89.01zm.287 5.984-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7 8.793l2.646-2.647a.5.5 0 0 1 .708.708" />
                                                        </svg>
                                                    </div>
                                                    <p className='video-desc text-suspensory-2lines'>{video.description}</p>
                                                </div>

                                                <div className='stats-row'>
                                                    <div className='stat-item'>
                                                        <i className="fa-solid fa-eye" aria-hidden="true"></i>
                                                        <span aria-label={t('viewsCount', video.views)}>{video.views}</span>
                                                    </div>
                                                    <div className='stat-item border-l border-r border-white/20'>
                                                        <i className="fa-solid fa-comment" aria-hidden="true"></i>
                                                        <span aria-label={t('commentsCount', video.comments)}>{video.comments}</span>
                                                    </div>
                                                    <div className='stat-item'>
                                                        <i className="fa-solid fa-heart" aria-hidden="true"></i>
                                                        <span aria-label={t('likesCount', video.likes)}>{video.likes}</span>
                                                    </div>
                                                </div>

                                                <div className={`botones-tiktok ${!video.LinkProducto ? 'single-btn' : ''}`}>
                                                    <button
                                                        className="btn-action btn-tiktok-glass"
                                                        onClick={e => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            trackEvent('click.navigation', {
                                                                click_chapter1: 'tiktok_carousel',
                                                                click_chapter2: username,
                                                                click_chapter3: 'video_card',
                                                                click_name: 'open_video_button',
                                                                video_url: video.url
                                                            });
                                                            sendTikTokEvent('click_ver_en_tiktok', video);
                                                            window.open(video.url, '_blank');
                                                        }}
                                                        aria-label={t('seeOnTiktok')}
                                                    >
                                                        <i className="fa-brands fa-tiktok"></i>
                                                        {t('seeOnTiktok')}
                                                    </button>

                                                    {video.LinkProducto && (
                                                        <button
                                                            className="btn-action btn-product-solid"
                                                            onClick={e => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                trackEvent('click.navigation', {
                                                                    click_chapter1: 'tiktok_carousel',
                                                                    click_chapter2: username,
                                                                    click_chapter3: 'video_card',
                                                                    click_name: 'open_product_link',
                                                                    destination_url: video.LinkProducto,
                                                                    video_url: video.url
                                                                });
                                                                window.open(video.LinkProducto, '_blank');
                                                            }}
                                                            aria-label={t('seeProduct')}
                                                        >
                                                            {t('seeProduct')}
                                                            <i className="fa-solid fa-arrow-right"></i>
                                                        </button>
                                                    )}
                                                </div>

                                            </div>
                                        </div>
                                    </div>
                                </SplideSlide>
                            ))}
                        </Splide>
                    </div>
                </div>

                <div className='flex justify-center mt-8'>
                    <a
                        className="btn-explore-pill"
                        target='_blank'
                        rel="noreferrer"
                        title={t('exploreMoreTitle')}
                        href={link}
                        onClick={() => {
                            trackEvent('click.navigation', {
                                click_chapter1: 'tiktok_carousel',
                                click_chapter2: username,
                                click_chapter3: 'footer',
                                click_name: 'explore_more_profile',
                                destination_url: link,
                                profile_username: username
                            });
                        }}
                        aria-label={t('exploreMore')}
                    >
                        {t('exploreMore')}
                        <i className="fa-brands fa-tiktok"></i>
                    </a>
                </div>
            </div>
        </>
    );
};

export default TiktokCarousel;