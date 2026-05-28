import React from 'react';
import { 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet, 
  Image, 
  Font, 
  pdf 
} from '@react-pdf/renderer';
import saveAs from 'file-saver';

// --- Font Registration ---
// Note: We use the local font paths available in the public directory
Font.register({
  family: 'DejaVuSans',
  fonts: [
    { src: '/fonts/DejaVuSans.ttf' },
    { src: '/fonts/DejaVuSans-Bold.ttf', fontWeight: 'bold' }
  ]
});

// --- Styles ---
const colors = {
  blue: '#0f74bd',
  orange: '#f25829',
  white: '#ffffff',
  dark: '#1e293b',
  grey: '#64748b',
  light: '#f1f5f9',
  tableHeader: '#0f74bd',
  tableRowOdd: '#ffffff',
  tableRowEven: '#f8fafc'
};

const styles = StyleSheet.create({
  page: {
    fontFamily: 'DejaVuSans',
    fontSize: 10,
    color: colors.dark,
    backgroundColor: colors.white,
    paddingBottom: 40 // space for footer
  },
  // Header
  header: {
    backgroundColor: colors.blue,
    height: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20
  },
  headerTitle: {
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold'
  },
  headerLogoContainer: {
    backgroundColor: colors.white,
    padding: 3,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerLogo: {
    width: 55,
    height: 'auto'
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 15,
    left: 20,
    right: 20,
    borderTopWidth: 0.5,
    borderTopColor: '#cbd5e1',
    paddingTop: 5,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  footerText: {
    fontSize: 8,
    color: colors.grey
  },
  // Cover Page
  coverPage: {
    fontFamily: 'DejaVuSans',
    backgroundColor: colors.white,
    height: '100%'
  },
  coverContainer: {
    height: '100%',
    width: '100%',
    display: 'flex',
    flexDirection: 'column'
  },
  coverTop: {
    flex: 3,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center'
  },
  logoCover: {
    width: 200,
    height: 'auto'
  },
  coverDivider: {
    height: 4,
    backgroundColor: colors.orange
  },
  coverBottom: {
    flex: 7,
    backgroundColor: colors.blue,
    paddingHorizontal: 40,
    paddingTop: 50,
    alignItems: 'center'
  },
  coverTitle: {
    color: colors.white,
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10
  },
  coverSubtitle: {
    color: colors.orange,
    fontSize: 38,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 50
  },
  targetBox: {
    borderRadius: 12,
    padding: 30,
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)'
  },
  targetLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    marginBottom: 15,
    letterSpacing: 1.5,
    fontWeight: 'bold'
  },
  targetValue: {
    color: colors.white,
    fontSize: 32,
    fontWeight: 'bold'
  },
  // Executive Summary Card Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 30
  },
  statCard: {
    width: '48%',
    borderRadius: 6,
    padding: 15,
    color: colors.white
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5
  },
  statLabel: {
    fontSize: 8,
    opacity: 0.9
  },
  // Sections
  section: {
    marginHorizontal: 20,
    marginBottom: 20
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.blue,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 5
  },
  // Table
  table: {
    width: '100%',
    marginHorizontal: 0
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: colors.tableHeader,
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 9,
    padding: 6
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    padding: 6,
    fontSize: 9
  },
  tableCellLabel: {
    width: '30%',
    color: colors.grey,
    fontWeight: 'bold'
  },
  tableCellValue: {
    width: '70%',
    color: colors.dark,
    lineHeight: 1.5
  },
  // Technical table columns
  col1: { width: '60%' },
  col2: { width: '40%' },
  colPort: { width: '20%' },
  colSvc: { width: '40%' },
  colState: { width: '20%' },
  colReason: { width: '20%' },
  // Recommendations
  recItem: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderLeftWidth: 3,
    borderLeftColor: colors.blue,
    padding: 10,
    marginBottom: 8,
    borderRadius: 2
  },
  recNum: {
    width: 25,
    fontWeight: 'bold',
    color: colors.blue
  },
  recText: {
    flex: 1,
    fontSize: 9
  }
});

// --- Components ---

const Header = ({ title }) => (
  <View style={styles.header} fixed>
    <Text style={styles.headerTitle}>{title}</Text>
    <View style={styles.headerLogoContainer}>
      <Image style={styles.headerLogo} src="/logo.png" />
    </View>
  </View>
);

const Footer = ({ pageNum, totalPages }) => (
  <View style={styles.footer} fixed>
    <Text style={styles.footerText}>SmartPro Recon Platform - Confidential Security Report</Text>
    <Text style={styles.footerText}>Page {pageNum} of {totalPages}</Text>
  </View>
);

const CleanText = ({ text, style }) => {
  if (!text) return <Text style={style}>N/A</Text>;
  let cleaned = text;
  // Fix the "Space between every char" pattern
  if (typeof cleaned === 'string' && cleaned.length > 10) {
    const everyOtherIsSpace = cleaned.split('').every((char, i) => i % 2 === 0 || char === ' ' || char === '&');
    if (everyOtherIsSpace) {
      cleaned = cleaned.replace(/[ &]/g, '');
    }
  }
  // Remove HTML tags
  cleaned = cleaned.replace(/<[^>]*>?/gm, '').trim();
  return <Text style={style}>{cleaned}</Text>;
};

const SmartProDocument = ({ job, results }) => {
  const totalPages = 7;
  const subdomains = results.results.subdomain_enum?.subdomains_list || [];
  const ports = results.results.port_scan?.ports || [];
  const tech = results.results.tech_detect?.technologies || [];
  const uniqueIps = [...new Set(subdomains.map(s => s.ip).filter(Boolean))];

  return (
    <Document>
      {/* PAGE 1: COVER */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverContainer}>
          <View style={styles.coverTop}>
            <Image style={styles.logoCover} src="/logo.png" />
          </View>
          <View style={styles.coverDivider} />
          <View style={styles.coverBottom}>
            <Text style={styles.coverTitle}>External Attack Surface</Text>
            <Text style={styles.coverSubtitle}>Intelligence Report</Text>
            <View style={styles.targetBox}>
              <Text style={styles.targetLabel}>TARGET ASSET</Text>
              <Text style={styles.targetValue}>{job.target}</Text>
            </View>
            <View style={{ marginTop: 60 }}>
              <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 10, textAlign: 'center' }}>
                Generated on: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
              </Text>
              <Text style={{ color: colors.white, fontSize: 11, fontWeight: 'bold', marginTop: 10, textAlign: 'center', letterSpacing: 1 }}>
                CONFIDENTIAL SECURITY REPORT
              </Text>
            </View>
          </View>
        </View>
      </Page>

      {/* PAGE 2: EXECUTIVE SUMMARY */}
      <Page size="A4" style={styles.page}>
        <Header title="EXECUTIVE SUMMARY" />
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Asset Overview</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>Primary Domain</Text>
              <Text style={styles.tableCellValue}>{job.target}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>Resolved IP</Text>
              <Text style={styles.tableCellValue}>{results.results.geo_info?.query || 'N/A'}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>Location</Text>
              <Text style={styles.tableCellValue}>{results.results.geo_info?.country}, {results.results.geo_info?.city}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>ISP</Text>
              <Text style={styles.tableCellValue}>{results.results.geo_info?.isp}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>Website Title</Text>
              <CleanText text={results.results.website_info?.title} style={styles.tableCellValue} />
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>Description</Text>
              <CleanText text={results.results.website_info?.description} style={styles.tableCellValue} />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Metrics</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: colors.blue }]}>
              <Text style={styles.statValue}>{subdomains.length}</Text>
              <Text style={styles.statLabel}>SUBDOMAINS FOUND</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#8b5cf6' }]}>
              <Text style={styles.statValue}>{ports.length}</Text>
              <Text style={styles.statLabel}>OPEN PORTS</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#64748b' }]}>
              <Text style={styles.statValue}>{uniqueIps.length || 1}</Text>
              <Text style={styles.statLabel}>IDENTIFIED IPs</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#0891b2' }]}>
              <Text style={styles.statValue}>{tech.length}</Text>
              <Text style={styles.statLabel}>TECHNOLOGIES</Text>
            </View>
          </View>
        </View>

        <Footer pageNum={2} totalPages={totalPages} />
      </Page>

      {/* PAGE 3: SUBDOMAINS */}
      <Page size="A4" style={styles.page}>
        <Header title="SUBDOMAIN ENUMERATION" />
        <View style={styles.section}>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={styles.col1}>Subdomain</Text>
              <Text style={styles.col2}>IP Address</Text>
            </View>
            {subdomains.map((s, i) => (
              <View key={i} style={[styles.tableRow, { backgroundColor: i % 2 === 0 ? colors.tableRowOdd : colors.tableRowEven }]}>
                <Text style={[styles.col1, { fontFamily: 'Courier' }]}>{s.subdomain}</Text>
                <Text style={styles.col2}>{s.ip || 'N/A'}</Text>
              </View>
            ))}
            {subdomains.length === 0 && (
              <View style={styles.tableRow}><Text>No subdomains identified.</Text></View>
            )}
          </View>
        </View>
        <Footer pageNum={3} totalPages={totalPages} />
      </Page>

      {/* PAGE 4: IP ADDRESSES */}
      <Page size="A4" style={styles.page}>
        <Header title="IP ADDRESSES" />
        <View style={styles.section}>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={styles.col1}>IP Address</Text>
              <Text style={styles.col2}>Status</Text>
            </View>
            {uniqueIps.length > 0 ? uniqueIps.map((ip, i) => (
              <View key={i} style={[styles.tableRow, { backgroundColor: i % 2 === 0 ? colors.tableRowOdd : colors.tableRowEven }]}>
                <Text style={styles.col1}>{ip}</Text>
                <Text style={[styles.col2, { color: '#10b981', fontWeight: 'bold' }]}>ACTIVE</Text>
              </View>
            )) : (
              <View style={styles.tableRow}>
                <Text style={styles.col1}>{results.results.geo_info?.query || 'N/A'}</Text>
                <Text style={[styles.col2, { color: '#10b981', fontWeight: 'bold' }]}>ACTIVE (PRIMARY)</Text>
              </View>
            )}
          </View>
        </View>
        <Footer pageNum={4} totalPages={totalPages} />
      </Page>

      {/* PAGE 5: TECHNOLOGIES */}
      <Page size="A4" style={styles.page}>
        <Header title="PRODUCTS AND TECHNOLOGIES" />
        <View style={styles.section}>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={styles.col1}>Technology / Product</Text>
              <Text style={styles.col2}>Version</Text>
            </View>
            {tech.map((t, i) => (
              <View key={i} style={[styles.tableRow, { backgroundColor: i % 2 === 0 ? colors.tableRowOdd : colors.tableRowEven }]}>
                <Text style={styles.col1}>{t.name}</Text>
                <Text style={styles.col2}>{t.version || 'Latest'}</Text>
              </View>
            ))}
            {tech.length === 0 && (
              <View style={styles.tableRow}><Text>No specific technologies identified.</Text></View>
            )}
          </View>
        </View>
        <Footer pageNum={5} totalPages={totalPages} />
      </Page>

      {/* PAGE 6: OPEN PORTS */}
      <Page size="A4" style={styles.page}>
        <Header title="OPEN PORTS" />
        <View style={styles.section}>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={styles.colPort}>Port</Text>
              <Text style={styles.colSvc}>Service</Text>
              <Text style={styles.colState}>State</Text>
              <Text style={styles.colReason}>Reason</Text>
            </View>
            {ports.map((p, i) => {
              const parts = String(p).split(':');
              const portNum = parts.length > 1 ? parts[1] : parts[0];
              const svcMap = { '80':'HTTP','443':'HTTPS','22':'SSH','21':'FTP','3306':'MySQL','9100':'Prometheus' };
              return (
                <View key={i} style={[styles.tableRow, { backgroundColor: i % 2 === 0 ? colors.tableRowOdd : colors.tableRowEven }]}>
                  <Text style={styles.colPort}>{portNum}</Text>
                  <Text style={styles.colSvc}>{svcMap[portNum] || 'Unknown'}</Text>
                  <Text style={[styles.colState, { color: '#10b981', fontWeight: 'bold' }]}>OPEN</Text>
                  <Text style={styles.colReason}>syn-ack</Text>
                </View>
              );
            })}
            {ports.length === 0 && (
              <View style={styles.tableRow}><Text>No open ports detected.</Text></View>
            )}
          </View>
        </View>
        <Footer pageNum={6} totalPages={totalPages} />
      </Page>

      {/* PAGE 7: WAF DETECTION */}
      <Page size="A4" style={styles.page}>
        <Header title="WAF DETECTION" />
        <View style={styles.section}>
          <View style={{ backgroundColor: '#f8fafc', padding: 20, borderRadius: 6, marginBottom: 20 }}>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: results.results.waf_detect?.waf_detected ? colors.orange : '#10b981', marginBottom: 10 }}>
              {results.results.waf_detect?.waf_detected ? 'WAF DETECTED' : 'NO WAF DETECTED'}
            </Text>
            <Text style={{ fontSize: 9, color: colors.grey, lineHeight: 1.5 }}>
              {results.results.waf_detect?.waf_detected 
                ? `The target is protected by ${results.results.waf_detect.firewall}. Direct attacks against the web application may be blocked or filtered.`
                : 'The target does not appear to be protected by a Web Application Firewall. Access to the web application is unrestricted.'}
            </Text>
          </View>

        </View>
        <Footer pageNum={7} totalPages={totalPages} />
      </Page>
    </Document>
  );
};

// --- Export Function ---
export const generatePDFReport = async (job, results) => {
  try {
    console.log('Generating PDF using react-pdf...');
    const blob = await pdf(<SmartProDocument job={job} results={results} />).toBlob();
    saveAs(blob, `SmartPro_Report_${job.target}.pdf`);
    console.log('PDF Generated Successfully');
  } catch (error) {
    console.error('PDF Generation Failed:', error);
    throw error;
  }
};
