import { useState, useEffect, useCallback, ReactNode } from 'react';
import {   useParams } from 'react-router-dom';
import styled from 'styled-components';
import { ToastContainer } from 'react-toastify';
import Masonry from 'react-masonry-css'

import colors from 'styles/colors';
import Heading from 'components/Form/Heading';
import Modal from 'components/Form/Modal';
import Footer from 'components/misc/Footer';
import Nav from 'components/Form/Nav';
import { RowProps }  from 'components/Form/Row';

import Loader from 'components/misc/Loader';
import ErrorBoundary from 'components/misc/ErrorBoundary';
import SelfScanMsg from 'components/misc/SelfScanMsg';
import DocContent from 'components/misc/DocContent';
import ProgressBar, { LoadingJob, LoadingState, initialJobs } from 'components/misc/ProgressBar';
import ActionButtons from 'components/misc/ActionButtons';
import AdditionalResources from 'components/misc/AdditionalResources';
import ViewRaw from 'components/misc/ViewRaw';

import ServerLocationCard from 'components/Results/ServerLocation';
import ServerInfoCard from 'components/Results/ServerInfo';
import HostNamesCard from 'components/Results/HostNames';
import WhoIsCard from 'components/Results/WhoIs';
import LighthouseCard from 'components/Results/Lighthouse';
import ScreenshotCard from 'components/Results/Screenshot';
import SslCertCard from 'components/Results/SslCert';
import HeadersCard from 'components/Results/Headers';
import CookiesCard from 'components/Results/Cookies';
import RobotsTxtCard from 'components/Results/RobotsTxt';
import DnsRecordsCard from 'components/Results/DnsRecords';
import RedirectsCard from 'components/Results/Redirects';
import TxtRecordCard from 'components/Results/TxtRecords';
import ServerStatusCard from 'components/Results/ServerStatus';
import OpenPortsCard from 'components/Results/OpenPorts';
import TraceRouteCard from 'components/Results/TraceRoute';
import CarbonFootprintCard from 'components/Results/CarbonFootprint';
import SiteFeaturesCard from 'components/Results/SiteFeatures';
import DnsSecCard from 'components/Results/DnsSec';
import HstsCard from 'components/Results/Hsts';
import SitemapCard from 'components/Results/Sitemap';
import DomainLookup from 'components/Results/DomainLookup';
import DnsServerCard from 'components/Results/DnsServer';
import TechStackCard from 'components/Results/TechStack';
import SecurityTxtCard from 'components/Results/SecurityTxt';
import ContentLinksCard from 'components/Results/ContentLinks';
import SocialTagsCard from 'components/Results/SocialTags';
import MailConfigCard from 'components/Results/MailConfig';

import keys from 'utils/get-keys';
import { determineAddressType, AddressType } from 'utils/address-type-checker';
import useMotherHook from 'hooks/motherOfAllHooks';
import {
  getLocation, ServerLocation,
  parseCookies, Cookie,
  parseRobotsTxt,
  applyWhoIsResults, Whois,
  parseShodanResults, ShodanResults
} from 'utils/result-processor';

const ResultsOuter = styled.div`
  display: flex;
  flex-direction: column;
  .masonry-grid {
    display: flex;
    width: auto;
  }
  .masonry-grid-col section { margin: 1rem 0.5rem; }
`;

const ResultsContent = styled.section`
  width: 95vw;
  display: grid;
  grid-auto-flow: dense;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1rem;
  margin: auto;
  width: calc(100% - 2rem);
  padding-bottom: 1rem;
`;

const Results = (): JSX.Element => {
  const startTime = new Date().getTime();

  const [ addressType, setAddressType ] = useState<AddressType>('empt');
  const { address } = useParams();

  const [loadingJobs, setLoadingJobs] = useState<LoadingJob[]>(initialJobs);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<ReactNode>(<></>);

  const updateLoadingJobs = useCallback((job: string, newState: LoadingState, error?: string, retry?: () => void, data?: any) => {
    const now = new Date();
    const timeTaken = now.getTime() - startTime;
    setLoadingJobs((prevJobs) => {
      const newJobs = prevJobs.map((loadingJob: LoadingJob) => {
        if (loadingJob.name === job) {
          return { ...loadingJob, error, state: newState, timeTaken, retry };
        }
        return loadingJob;
      });

      const timeString = `[${now.getHours().toString().padStart(2, '0')}:`
        +`${now.getMinutes().toString().padStart(2, '0')}:`
        + `${now.getSeconds().toString().padStart(2, '0')}]`;


      if (newState === 'success') {
        console.log(
          `%cFetch Success - ${job}%c\n\n${timeString}%c The ${job} job succeeded in ${timeTaken}ms`
          + `\n%cRun %cwindow.webCheck['${job}']%c to inspect the raw the results`,
          `background:${colors.success};color:${colors.background};padding: 4px 8px;font-size:16px;`,
          `font-weight: bold; color: ${colors.success};`,
          `color: ${colors.success};`,
          `color: #1d8242;`,`color: #1d8242;text-decoration:underline;`,`color: #1d8242;`,
        );
        if (!(window as any).webCheck) (window as any).webCheck = {};
        if (data) (window as any).webCheck[job] = data;
      }
  
      if (newState === 'error') {
        console.log(
          `%cFetch Error - ${job}%c\n\n${timeString}%c The ${job} job failed `
          +`after ${timeTaken}ms, with the following error:%c\n${error}`,
          `background: ${colors.danger}; padding: 4px 8px; font-size: 16px;`,
          `font-weight: bold; color: ${colors.danger};`,
          `color: ${colors.danger};`,
          `color: ${colors.warning};`,
        );
      }
      return newJobs;
    });
  }, []);

  const parseJson = (response: Response): Promise<any> => {
    return new Promise((resolve) => {
        response.json()
          .then(data => resolve(data))
          .catch(error => resolve(
            { error: `Failed to get a valid response 😢\n`
            + `This is likely due the target not exposing the required data, `
            + `or limitations in how Netlify executes lambda functions, such as the 10-sec timeout.\n\n`
            + `Error info:\n${error}`}
          ));
    });
  };

  useEffect(() => {
    if (!addressType || addressType === 'empt') {
      setAddressType(determineAddressType(address || ''));
    }
    if (addressType === 'ipV4' && address) {
      setIpAddress(address);
    }
  }, []);  

  const urlTypeOnly = ['url'] as AddressType[]; // Many jobs only run with these address types

  const api = '/api';

  // Fetch and parse IP address for given URL
  const [ipAddress, setIpAddress] = useMotherHook({
    jobId: 'get-ip',
    updateLoadingJobs,
    addressInfo: { address, addressType, expectedAddressTypes: urlTypeOnly },
    fetchRequest: () => fetch(`${api}/find-url-ip?url=${address}`)
    .then(res => parseJson(res))
    .then(res => res.ip),
  });

  // Fetch and parse SSL certificate info
  const [sslResults, updateSslResults] = useMotherHook({
    jobId: 'ssl',
    updateLoadingJobs,
    addressInfo: { address, addressType, expectedAddressTypes: urlTypeOnly },
    fetchRequest: () => fetch(`${api}/ssl-check?url=${address}`).then((res) => parseJson(res)),
  });

  // Fetch and parse cookies info
  const [cookieResults, updateCookieResults] = useMotherHook<{cookies: Cookie[]}>({
    jobId: 'cookies',
    updateLoadingJobs,
    addressInfo: { address, addressType, expectedAddressTypes: urlTypeOnly },
    fetchRequest: () => fetch(`${api}/get-cookies?url=${address}`)
      .then(res => parseJson(res))
      .then(res => parseCookies(res.cookies)),
  });

  // Fetch and parse crawl rules from robots.txt
  const [robotsTxtResults, updateRobotsTxtResults] = useMotherHook<{robots: RowProps[]}>({
    jobId: 'robots-txt',
    updateLoadingJobs,
    addressInfo: { address, addressType, expectedAddressTypes: urlTypeOnly },
    fetchRequest: () => fetch(`${api}/read-robots-txt?url=${address}`)
      .then(res => res.text())
      .then(res => parseRobotsTxt(res)),
  });

  // Fetch and parse headers
  const [headersResults, updateHeadersResults] = useMotherHook({
    jobId: 'headers',
    updateLoadingJobs,
    addressInfo: { address, addressType, expectedAddressTypes: urlTypeOnly },
    fetchRequest: () => fetch(`${api}/get-headers?url=${address}`).then(res => parseJson(res)),
  });

  // Fetch and parse DNS records
  const [dnsResults, updateDnsResults] = useMotherHook({
    jobId: 'dns',
    updateLoadingJobs,
    addressInfo: { address, addressType, expectedAddressTypes: urlTypeOnly },
    fetchRequest: () => fetch(`${api}/get-dns?url=${address}`).then(res => parseJson(res)),
  });

  // Fetch and parse Lighthouse performance data
  const [lighthouseResults, updateLighthouseResults] = useMotherHook({
    jobId: 'quality',
    updateLoadingJobs,
    addressInfo: { address, addressType, expectedAddressTypes: urlTypeOnly },
    fetchRequest: () => fetch(`${api}/lighthouse-report?url=${address}`)
      .then(res => parseJson(res))
      .then(res => res?.lighthouseResult || { error: 'No Data'}),
  });

  // Get IP address location info
  const [locationResults, updateLocationResults] = useMotherHook<ServerLocation>({
    jobId: 'location',
    updateLoadingJobs,
    addressInfo: { address: ipAddress, addressType: 'ipV4', expectedAddressTypes: ['ipV4', 'ipV6'] },
    fetchRequest: () => fetch(`https://ipapi.co/${ipAddress}/json/`)
      .then(res => parseJson(res))
      .then(res => getLocation(res)),
  });

  // Get hostnames and associated domains from Shodan
  const [shoadnResults, updateShodanResults] = useMotherHook<ShodanResults>({
    jobId: 'hosts',
    updateLoadingJobs,
    addressInfo: { address: ipAddress, addressType: 'ipV4', expectedAddressTypes: ['ipV4', 'ipV6'] },
    fetchRequest: () => fetch(`https://api.shodan.io/shodan/host/${ipAddress}?key=${keys.shodan}`)
      .then(res => parseJson(res))
      .then(res => parseShodanResults(res)),
  });

  // Check for open ports
  const [portsResults, updatePortsResults] = useMotherHook({
    jobId: 'ports',
    updateLoadingJobs,
    addressInfo: { address: ipAddress, addressType: 'ipV4', expectedAddressTypes: ['ipV4', 'ipV6'] },
    fetchRequest: () => fetch(`${api}/check-ports?url=${ipAddress}`)
      .then(res => parseJson(res)),
  });

  // Fetch and parse domain whois results
  const [whoIsResults, updateWhoIsResults] = useMotherHook<Whois | { error: string }>({
    jobId: 'whois',
    updateLoadingJobs,
    addressInfo: { address, addressType, expectedAddressTypes: urlTypeOnly },
    fetchRequest: () => fetch(`https://api.whoapi.com/?domain=${address}&r=whois&apikey=${keys.whoApi}`)
      .then(res => parseJson(res))
      .then(res => applyWhoIsResults(res)),
  });

  // Fetches DNS TXT records
  const [txtRecordResults, updateTxtRecordResults] = useMotherHook({
    jobId: 'txt-records',
    updateLoadingJobs,
    addressInfo: { address, addressType, expectedAddressTypes: urlTypeOnly },
    fetchRequest: () => fetch(`${api}/get-txt?url=${address}`).then(res => parseJson(res)),
  });

  // Fetches URL redirects
  const [redirectResults, updateRedirectResults] = useMotherHook({
    jobId: 'redirects',
    updateLoadingJobs,
    addressInfo: { address, addressType, expectedAddressTypes: urlTypeOnly },
    fetchRequest: () => fetch(`${api}/follow-redirects?url=${address}`).then(res => parseJson(res)),
  });

  // Get current status and response time of server
  const [serverStatusResults, updateServerStatusResults] = useMotherHook({
    jobId: 'status',
    updateLoadingJobs,
    addressInfo: { address, addressType, expectedAddressTypes: urlTypeOnly },
    fetchRequest: () => fetch(`${api}/server-status?url=${address}`).then(res => parseJson(res)),
  });

  // Get current status and response time of server
  const [techStackResults, updateTechStackResults] = useMotherHook({
    jobId: 'tech-stack',
    updateLoadingJobs,
    addressInfo: { address, addressType, expectedAddressTypes: urlTypeOnly },
    fetchRequest: () => fetch(`${api}/tech-stack?url=${address}`).then(res => parseJson(res)),
  });

  // Get trace route for a given hostname
  const [traceRouteResults, updateTraceRouteResults] = useMotherHook({
    jobId: 'trace-route',
    updateLoadingJobs,
    addressInfo: { address, addressType, expectedAddressTypes: urlTypeOnly },
    fetchRequest: () => fetch(`${api}/trace-route?url=${address}`).then(res => parseJson(res)),
  });

  // Fetch carbon footprint data for a given site
  const [carbonResults, updateCarbonResults] = useMotherHook({
    jobId: 'carbon',
    updateLoadingJobs,
    addressInfo: { address, addressType, expectedAddressTypes: urlTypeOnly },
    fetchRequest: () => fetch(`${api}/get-carbon?url=${address}`).then(res => parseJson(res)),
  });

  // Check if a site is on the HSTS preload list
  const [hstsResults, updateHstsResults] = useMotherHook({
    jobId: 'hsts',
    updateLoadingJobs,
    addressInfo: { address, addressType, expectedAddressTypes: urlTypeOnly },
    fetchRequest: () => fetch(`${api}/check-hsts?url=${address}`).then(res => parseJson(res)),
  });

  // Get a websites listed pages, from sitemap
  const [sitemapResults, updateSitemapResults] = useMotherHook({
    jobId: 'sitemap',
    updateLoadingJobs,
    addressInfo: { address, addressType, expectedAddressTypes: urlTypeOnly },
    fetchRequest: () => fetch(`${api}/sitemap?url=${address}`).then(res => parseJson(res)),
  });

  // Get a websites listed pages, from sitemap
  const [screenshotResult, updateScreenshotResult] = useMotherHook({
    jobId: 'screenshot',
    updateLoadingJobs,
    addressInfo: { address, addressType, expectedAddressTypes: urlTypeOnly },
    fetchRequest: () => fetch(`${api}/screenshot?url=${address}`).then(res => parseJson(res)),
  });

  // Get a websites listed pages, from sitemap
  const [securityTxtResults, updateSecurityTxtResults] = useMotherHook({
    jobId: 'security-txt',
    updateLoadingJobs,
    addressInfo: { address, addressType, expectedAddressTypes: urlTypeOnly },
    fetchRequest: () => fetch(`${api}/security-txt?url=${address}`).then(res => parseJson(res)),
  });

  // Get social media previews, from a sites social meta tags
  const [socialTagResults, updateSocialTagResults] = useMotherHook({
    jobId: 'social-tags',
    updateLoadingJobs,
    addressInfo: { address, addressType, expectedAddressTypes: urlTypeOnly },
    fetchRequest: () => fetch(`${api}/social-tags?url=${address}`).then(res => parseJson(res)),
  });

  // Get site features from BuiltWith
  const [siteFeaturesResults, updateSiteFeaturesResults] = useMotherHook({
    jobId: 'features',
    updateLoadingJobs,
    addressInfo: { address, addressType, expectedAddressTypes: urlTypeOnly },
    fetchRequest: () => fetch(`${api}/site-features?url=${address}`)
    .then(res => parseJson(res))
    .then(res => {
      if (res.Errors && res.Errors.length > 0) {
        return { error: `No data returned, because ${res.Errors[0].Message || 'API lookup failed'}` };
      }
      return res;
    }),
  });

  // Get DNSSEC info
  const [dnsSecResults, updateDnsSecResults] = useMotherHook({
    jobId: 'dnssec',
    updateLoadingJobs,
    addressInfo: { address, addressType, expectedAddressTypes: urlTypeOnly },
    fetchRequest: () => fetch(`${api}/dns-sec?url=${address}`).then(res => parseJson(res)),
  });

  // Run a manual whois lookup on the domain
  const [domainLookupResults, updateDomainLookupResults] = useMotherHook({
    jobId: 'domain',
    updateLoadingJobs,
    addressInfo: { address, addressType, expectedAddressTypes: urlTypeOnly },
    fetchRequest: () => fetch(`${api}/whois-lookup?url=${address}`).then(res => parseJson(res)),
  });

  // Get the DNS server(s) for a domain, and test DoH/DoT support
  const [dnsServerResults, updateDnsServerResults] = useMotherHook({
    jobId: 'dns-server',
    updateLoadingJobs,
    addressInfo: { address, addressType, expectedAddressTypes: urlTypeOnly },
    fetchRequest: () => fetch(`${api}/dns-server?url=${address}`).then(res => parseJson(res)),
  });

  // Get list of links included in the page content
  const [linkedPagesResults, updateLinkedPagesResults] = useMotherHook({
    jobId: 'linked-pages',
    updateLoadingJobs,
    addressInfo: { address, addressType, expectedAddressTypes: urlTypeOnly },
    fetchRequest: () => fetch(`${api}/content-links?url=${address}`).then(res => parseJson(res)),
  });

  // Get mail config for server, based on DNS records
  const [mailConfigResults, updateMailConfigResults] = useMotherHook({
    jobId: 'mail-config',
    updateLoadingJobs,
    addressInfo: { address, addressType, expectedAddressTypes: urlTypeOnly },
    fetchRequest: () => fetch(`${api}/mail-config?url=${address}`).then(res => parseJson(res)),
  });

  /* Cancel remaining jobs after  10 second timeout */
  useEffect(() => {
    const checkJobs = () => {
      loadingJobs.forEach(job => {
        if (job.state === 'loading') {
          updateLoadingJobs(job.name, 'timed-out');
        }
      });
    };
    const timeoutId = setTimeout(checkJobs, 10000);
    return () => {
      clearTimeout(timeoutId);
    };
  }, [loadingJobs, updateLoadingJobs]); // dependencies for the effect

  const makeSiteName = (address: string): string => {
    try {
      return new URL(address).hostname.replace('www.', '');
    } catch (error) {
      return address;
    }
  }

  // A list of state sata, corresponding component and title for each card
  const resultCardData = [
    { id: 'location', title: 'Server Location', result: locationResults, Component: ServerLocationCard, refresh: updateLocationResults },
    { id: 'ssl', title: 'SSL Info', result: sslResults, Component: SslCertCard, refresh: updateSslResults },
    { id: 'headers', title: 'Headers', result: headersResults, Component: HeadersCard, refresh: updateHeadersResults },
    { id: 'domain', title: 'Whois', result: domainLookupResults, Component: DomainLookup, refresh: updateDomainLookupResults },
    { id: 'dns', title: 'DNS Records', result: dnsResults, Component: DnsRecordsCard, refresh: updateDnsResults },
    { id: 'hosts', title: 'Host Names', result: shoadnResults?.hostnames, Component: HostNamesCard, refresh: updateShodanResults },
    { id: 'tech-stack', title: 'Tech Stack', result: techStackResults, Component: TechStackCard, refresh: updateTechStackResults },
    { id: 'quality', title: 'Quality Summary', result: lighthouseResults, Component: LighthouseCard, refresh: updateLighthouseResults },
    { id: 'cookies', title: 'Cookies', result: cookieResults, Component: CookiesCard, refresh: updateCookieResults },
    { id: 'trace-route', title: 'Trace Route', result: traceRouteResults, Component: TraceRouteCard, refresh: updateTraceRouteResults },
    { id: 'server-info', title: 'Server Info', result: shoadnResults?.serverInfo, Component: ServerInfoCard, refresh: updateShodanResults },
    { id: 'redirects', title: 'Redirects', result: redirectResults, Component: RedirectsCard, refresh: updateRedirectResults },
    { id: 'robots-txt', title: 'Crawl Rules', result: robotsTxtResults, Component: RobotsTxtCard, refresh: updateRobotsTxtResults },
    { id: 'dnssec', title: 'DNSSEC', result: dnsSecResults, Component: DnsSecCard, refresh: updateDnsSecResults },
    { id: 'status', title: 'Server Status', result: serverStatusResults, Component: ServerStatusCard, refresh: updateServerStatusResults },
    { id: 'ports', title: 'Open Ports', result: portsResults, Component: OpenPortsCard, refresh: updatePortsResults },
    { id: 'security-txt', title: 'Security.Txt', result: securityTxtResults, Component: SecurityTxtCard, refresh: updateSecurityTxtResults },
    { id: 'screenshot', title: 'Screenshot', result: screenshotResult || lighthouseResults?.fullPageScreenshot?.screenshot, Component: ScreenshotCard, refresh: updateScreenshotResult },
    { id: 'txt-records', title: 'TXT Records', result: txtRecordResults, Component: TxtRecordCard, refresh: updateTxtRecordResults },
    { id: 'hsts', title: 'HSTS Check', result: hstsResults, Component: HstsCard, refresh: updateHstsResults },
    { id: 'whois', title: 'Domain Info', result: whoIsResults, Component: WhoIsCard, refresh: updateWhoIsResults },
    { id: 'mail-config', title: 'Email Configuration', result: mailConfigResults, Component: MailConfigCard, refresh: updateMailConfigResults },
    { id: 'dns-server', title: 'DNS Server', result: dnsServerResults, Component: DnsServerCard, refresh: updateDnsServerResults },
    { id: 'social-tags', title: 'Social Tags', result: socialTagResults, Component: SocialTagsCard, refresh: updateSocialTagResults },
    { id: 'linked-pages', title: 'Linked Pages', result: linkedPagesResults, Component: ContentLinksCard, refresh: updateLinkedPagesResults },
    { id: 'features', title: 'Site Features', result: siteFeaturesResults, Component: SiteFeaturesCard, refresh: updateSiteFeaturesResults },
    { id: 'sitemap', title: 'Pages', result: sitemapResults, Component: SitemapCard, refresh: updateSitemapResults },
    { id: 'carbon', title: 'Carbon Footprint', result: carbonResults, Component: CarbonFootprintCard, refresh: updateCarbonResults },
    
  ];

  const MakeActionButtons = (title: string, refresh: () => void, showInfo: (id: string) => void): ReactNode => {
    const actions = [
      { label: `Info about ${title}`, onClick: showInfo, icon: 'ⓘ'},
      { label: `Re-fetch ${title} data`, onClick: refresh, icon: '↻'},
    ];
    return (
      <ActionButtons actions={actions} />
    );
  };

  const showInfo = (id: string) => {
    setModalContent(DocContent(id));
    setModalOpen(true);
  };

  const showErrorModal = (content: ReactNode) => {
    setModalContent(content);
    setModalOpen(true);
  };
  
  return (
    <ResultsOuter>
      <Nav>
      { address && 
        <Heading color={colors.textColor} size="medium">
          { addressType === 'url' && <img width="32px" src={`https://icon.horse/icon/${makeSiteName(address)}`} alt="" /> }
          {makeSiteName(address)}
        </Heading>
        }
      </Nav>
      <ProgressBar loadStatus={loadingJobs} showModal={showErrorModal} showJobDocs={showInfo} />
      { address?.includes(window?.location?.hostname || 'web-check.as93.net') && <SelfScanMsg />}
      <Loader show={loadingJobs.filter((job: LoadingJob) => job.state !== 'loading').length < 5} />
      <ResultsContent>
        
      <Masonry
          breakpointCols={{ 10000: 12, 4000: 9, 3600: 8, 3200: 7, 2800: 6, 2400: 5, 2000: 4, 1600: 3, 1200: 2, 800: 1 }}
          className="masonry-grid"
          columnClassName="masonry-grid-col">
          {
            resultCardData.map(({ id, title, result, refresh, Component }, index: number) => (
              (result && !result.error) ? (
                <ErrorBoundary title={title}>
                  <Component
                    key={`${title}-${index}`}
                    data={{...result}}
                    title={title}
                    actionButtons={refresh ? MakeActionButtons(title, refresh, () => showInfo(id)) : undefined}
                  />
                </ErrorBoundary>
              ) : <></>
            ))
          }
          </Masonry>
      </ResultsContent>
      <ViewRaw everything={resultCardData} />
      <AdditionalResources url={address} />
      <Footer />
      <Modal isOpen={modalOpen} closeModal={()=> setModalOpen(false)}>{modalContent}</Modal>
      <ToastContainer limit={3} draggablePercent={60} autoClose={2500} theme="dark" position="bottom-right" />
    </ResultsOuter>
  );
}

export default Results;
