import { Helmet } from "react-helmet";
import TiktokCarousel from '../../../components/TiktokCarousel/TiktokCarousel';
import videosData from './hikvisionlatam_tiktok_videos.json';

const HikvisionLatamPage = () => {
    return (
        <>
            <Helmet>
                <title>Hikvision LATAM - TikTok</title>
                <meta name="description" content="Descubre los videos más recientes de Hikvision LATAM en TikTok." />
            </Helmet>
            <TiktokCarousel
                videosData={videosData}
                username="hikvisionlatam"
                link="https://www.tiktok.com/@hikvisionlatam"
                country="es"
            />
        </>
    );
};

export default HikvisionLatamPage;