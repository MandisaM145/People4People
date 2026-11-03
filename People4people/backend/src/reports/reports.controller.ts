import { Controller, Post, Body, Get, Param, Patch, Query } from '@nestjs/common';

export interface IncidentReport {
  id: string;
  reportNumber: string;
  category: string;
  description: string;
  latitude: number;
  longitude: number;
  status: 'Pending' | 'In Progress' | 'Resolved';
  assignedCrew?: string;
  photoBase64?: string;
  createdAt: string;
}

// In-memory store for development testing
const mockReports: IncidentReport[] = [
  {
    id: '1',
    reportNumber: 'P4P-102938',
    category: 'Damaged Road / Pothole',
    description: 'Deep pothole causing vehicle tire damage near main junction.',
    latitude: -29.8587,
    longitude: 31.0218,
    status: 'Pending',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    reportNumber: 'P4P-847201',
    category: 'Water Leak / Pipe Burst',
    description: 'Clean water running down street for 3 days.',
    latitude: -29.8500,
    longitude: 31.0150,
    status: 'In Progress',
    assignedCrew: 'Water Maintenance Unit 4',
    createdAt: new Date().toISOString(),
  },
];

@Controller('api/v1/reports')
export class ReportsController {

  // 1. Submit Report with optional photo upload
  @Post()
  createReport(
    @Body()
    body: {
      description: string;
      category: string;
      latitude: number;
      longitude: number;
      photoBase64?: string;
    },
  ) {
    const reportNumber = 'P4P-' + Math.floor(100000 + Math.random() * 900000);
    const newReport: IncidentReport = {
      id: Date.now().toString(),
      reportNumber,
      category: body.category,
      description: body.description,
      latitude: body.latitude,
      longitude: body.longitude,
      status: 'Pending',
      photoBase64: body.photoBase64,
      createdAt: new Date().toISOString(),
    };

    mockReports.unshift(newReport);

    return {
      status: 'success',
      message: 'Report logged successfully',
      reportNumber,
      data: newReport,
    };
  }

  // 2. Fetch all reports with optional status and category filtering
  @Get()
  getReports(
    @Query('category') category?: string,
    @Query('status') status?: string,
  ) {
    return mockReports.filter((r) => {
      const matchCategory = !category || category === 'ALL' || r.category === category;
      const matchStatus = !status || status === 'ALL' || r.status === status;
      return matchCategory && matchStatus;
    });
  }

  // 3. Ticket Status Lookup by Report Number
  @Get('track/:reportNumber')
  trackTicket(@Param('reportNumber') reportNumber: string) {
    const report = mockReports.find(
      (r) => r.reportNumber.toUpperCase() === reportNumber.trim().toUpperCase(),
    );
    if (!report) {
      return { found: false, message: 'Ticket number not found.' };
    }
    return { found: true, report };
  }

  // 4. Admin Actions: Update Status and Assign Work Crew
  @Patch(':id')
  updateReportStatus(
    @Param('id') id: string,
    @Body() body: { status?: 'Pending' | 'In Progress' | 'Resolved'; assignedCrew?: string },
  ) {
    const report = mockReports.find((r) => r.id === id);
    if (!report) {
      return { success: false, message: 'Report not found' };
    }

    if (body.status) report.status = body.status;
    if (body.assignedCrew !== undefined) report.assignedCrew = body.assignedCrew;

    return { success: true, message: 'Report updated', report };
  }
}