'use client';

import { useState, useEffect } from 'react';
import { Card, Steps, Button, Alert, Typography, Spin, message } from 'antd';
import { initializeGoogleSheets, authenticateUser } from '@/utils/googleSheets';
import AppLayout from '@/components/AppLayout';

const { Title, Paragraph, Text } = Typography;
const { Step } = Steps;

export default function SetupPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await initializeGoogleSheets();
        setCurrentStep(1);
      } catch (error) {
        console.error('Error initializing API:', error);
        setError('Failed to initialize Google Sheets API. Please check your environment variables and reload the page.');
      }
    };

    init();
  }, []);

  const handleAuthenticate = async () => {
    setLoading(true);
    try {
      await authenticateUser();
      setAuthenticated(true);
      setCurrentStep(2);
      message.success('Successfully authenticated with Google Sheets');
    } catch (error) {
      console.error('Authentication error:', error);
      setError('Failed to authenticate. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const createSheetStructure = async () => {
    setLoading(true);
    
    try {
      const token = gapi.client.getToken();
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      // Create the spreadsheet structure
      const response = await gapi.client.sheets.spreadsheets.get({
        spreadsheetId: process.env.NEXT_PUBLIC_GOOGLE_SHEETS_ID,
        includeGridData: false,
      });
      
      const sheetsInfo = response.result.sheets;
      const sheetNames = sheetsInfo.map(sheet => sheet.properties.title);
      
      // Check if we need to add the prices sheet
      if (!sheetNames.includes('prices')) {
        // Add the prices sheet
        await gapi.client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: process.env.NEXT_PUBLIC_GOOGLE_SHEETS_ID,
          resource: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: 'prices',
                    gridProperties: {
                      rowCount: 1000,
                      columnCount: 7,
                    }
                  }
                }
              }
            ]
          }
        });
        
        // Add the header row
        await gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId: process.env.NEXT_PUBLIC_GOOGLE_SHEETS_ID,
          range: 'prices!A1:G1',
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [['ID', 'Room ID', 'Start Date', 'End Date', 'Price Type', 'Price Value', 'Rule Name']]
          }
        });
        
        message.success('Created "prices" sheet successfully');
      } else {
        // Update the header row in case it needs expanding
        try {
          const headersResponse = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: process.env.NEXT_PUBLIC_GOOGLE_SHEETS_ID,
            range: 'prices!A1:G1',
          });
          
          const headers = headersResponse.result.values && headersResponse.result.values[0];
          if (!headers || headers.length < 7) {
            // Update headers to include the new fields
            await gapi.client.sheets.spreadsheets.values.update({
              spreadsheetId: process.env.NEXT_PUBLIC_GOOGLE_SHEETS_ID,
              range: 'prices!A1:G1',
              valueInputOption: 'USER_ENTERED',
              resource: {
                values: [['ID', 'Room ID', 'Start Date', 'End Date', 'Price Type', 'Price Value', 'Rule Name']]
              }
            });
            message.success('Updated "prices" sheet structure');
          } else {
            message.info('Prices sheet already exists with the correct structure');
          }
        } catch (error) {
          console.warn('Error checking prices headers:', error);
          message.warning('Prices sheet exists but its structure might need updating');
        }
      }
      
      // Check if we need to update bookings structure
      if (sheetNames.includes('bookings')) {
        try {
          const bookingsHeadersResponse = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: process.env.NEXT_PUBLIC_GOOGLE_SHEETS_ID,
            range: 'bookings!A1:M1',
          });
          
          const bookingHeaders = bookingsHeadersResponse.result.values && bookingsHeadersResponse.result.values[0];
          if (!bookingHeaders || bookingHeaders.length < 13) {
            // Update headers to include the new fields
            await gapi.client.sheets.spreadsheets.values.update({
              spreadsheetId: process.env.NEXT_PUBLIC_GOOGLE_SHEETS_ID,
              range: 'bookings!A1:M1',
              valueInputOption: 'USER_ENTERED',
              resource: {
                values: [['ID', 'Room ID', 'Guest Name', 'Phone', 'Check In', 'Check Out', 'Total Price', 'Status', 'Base Price', 'Price Per Night', 'Nights', 'Selected Rule IDs', 'Notes']]
              }
            });
            message.success('Updated "bookings" sheet structure for price rules');
          }
        } catch (error) {
          console.warn('Error checking bookings headers:', error);
          message.warning('Bookings sheet exists but its structure might need updating');
        }
      }
      
      // Add a sample price rule if there are none
      try {
        const pricesResponse = await gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: process.env.NEXT_PUBLIC_GOOGLE_SHEETS_ID,
          range: 'prices!A2:G',
        });
        
        const priceRows = pricesResponse.result.values || [];
        if (priceRows.length === 0) {
          // Add sample rules
          const today = new Date();
          const sixMonthsLater = new Date();
          sixMonthsLater.setMonth(today.getMonth() + 6);
          
          const todayStr = today.toISOString().split('T')[0];
          const laterStr = sixMonthsLater.toISOString().split('T')[0];
          
          await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: process.env.NEXT_PUBLIC_GOOGLE_SHEETS_ID,
            range: 'prices!A2:G',
            valueInputOption: 'USER_ENTERED',
            resource: {
              values: [
                ['1', 'all', todayStr, laterStr, 'percentage', '-10', 'Early Bird Discount'],
                ['2', 'all', todayStr, laterStr, 'percentage', '15', 'Weekend Premium'],
                ['3', 'all', todayStr, laterStr, 'fixed', '150', 'Holiday Season Rate']
              ]
            }
          });
          
          message.success('Added sample pricing rules');
        }
      } catch (error) {
        console.warn('Error checking for sample price rules:', error);
      }
      
      setSuccess(true);
      setCurrentStep(3);
    } catch (error) {
      console.error('Error creating sheet structure:', error);
      setError(`Failed to create spreadsheet structure: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      title: 'Initialize API',
      content: 'Initializing Google Sheets API...',
    },
    {
      title: 'Authenticate',
      content: (
        <div>
          <Paragraph>
            Please authenticate with your Google account to access Google Sheets.
          </Paragraph>
          <Button type="primary" onClick={handleAuthenticate} loading={loading}>
            Authenticate with Google
          </Button>
        </div>
      ),
    },
    {
      title: 'Create Structure',
      content: (
        <div>
          <Paragraph>
            This will create the necessary sheet structure for dynamic pricing.
          </Paragraph>
          <Button type="primary" onClick={createSheetStructure} loading={loading}>
            Create Sheet Structure
          </Button>
        </div>
      ),
    },
    {
      title: 'Complete',
      content: (
        <div>
          <Alert
            message="Setup Complete"
            description="Your Google Sheets is now set up for dynamic pricing. You can start using the pricing management feature."
            type="success"
            showIcon
          />
          <div style={{ marginTop: 16 }}>
            <Button type="primary" href="/pricing">
              Go to Pricing Management
            </Button>
          </div>
        </div>
      ),
    },
  ];

  if (error) {
    return (
      <AppLayout>
        <Card>
          <Alert
            message="Setup Error"
            description={error}
            type="error"
            showIcon
          />
          <div style={{ marginTop: 16 }}>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </div>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Title level={2}>Google Sheets Setup</Title>
      <Paragraph>
        This page will help you set up the necessary Google Sheets structure for dynamic pricing functionality.
      </Paragraph>
      
      <Card>
        <Steps current={currentStep}>
          {steps.map(item => (
            <Step key={item.title} title={item.title} />
          ))}
        </Steps>
        
        <div className="steps-content" style={{ margin: '24px 0', minHeight: 200 }}>
          {loading && currentStep !== 3 ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>Processing...</div>
            </div>
          ) : (
            steps[currentStep].content
          )}
        </div>
      </Card>
    </AppLayout>
  );
} 