// src/tools/controllers/tools.controller.ts

import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    ParseUUIDPipe,
    ValidationPipe,
    HttpStatus,
    HttpException
} from '@nestjs/common';
import { ToolsManagementService } from '../services/tools-management.service';
import {
    CreateToolDto,
    UpdateToolDto,
    CreateCategoryDto,
    UpdateCategoryDto,
    ToolQueryParams,
    ServiceResponse,
    PaginatedResponse,
    ToolResponseDto,
    ToolUpdateResult
} from '../interfaces/tools.interface';

@Controller('tools')
export class ToolsController {
    constructor(private readonly toolsService: ToolsManagementService) { }

    // Tool endpoints
    @Post()
    async createTool(
        @Body(new ValidationPipe({ transform: true })) createToolDto: CreateToolDto
    ) {
        const response = await this.toolsService.createTool(createToolDto);
        if (!response.success) {
            throw new HttpException(
                response.error,
                HttpStatus.BAD_REQUEST
            );
        }
        return response.data;
    }

    @Get()
    async getTools(
        @Query(new ValidationPipe({ transform: true })) params: ToolQueryParams
    ): Promise<PaginatedResponse<ToolResponseDto>> {
        const response = await this.toolsService.getTools(params);
        if (!response.success) {
            throw new HttpException(
                response.error,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
        return response.data;
    }

    @Get(':id')
    async getTool(
        @Param('id', ParseUUIDPipe) id: string
    ): Promise<ToolResponseDto> {
        const response = await this.toolsService.getTool(id);
        if (!response.success) {
            throw new HttpException(
                response.error,
                response.error.code === 'TOOL_NOT_FOUND'
                    ? HttpStatus.NOT_FOUND
                    : HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
        return response.data;
    }

    @Get('fullDetails/:id')
    async getFullTool(
        @Param('id', ParseUUIDPipe) id: string
    ): Promise<ToolResponseDto> {
        const response = await this.toolsService.getFullTool(id);
        if (!response.success) {
            throw new HttpException(
                response.error,
                response.error.code === 'TOOL_NOT_FOUND'
                    ? HttpStatus.NOT_FOUND
                    : HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
        return response.data;
    }

    @Put(':id')
    async updateTool(
        @Param('id', ParseUUIDPipe) id: string,
        @Body(new ValidationPipe({ transform: true })) updateToolDto: UpdateToolDto
    ): Promise<ToolUpdateResult> {
        const response = await this.toolsService.updateTool(id, updateToolDto);
        if (!response.success) {
            throw new HttpException(
                response.error,
                response.error.code === 'TOOL_NOT_FOUND'
                    ? HttpStatus.NOT_FOUND
                    : HttpStatus.BAD_REQUEST
            );
        }
        return response.data;
    }

    @Delete(':id')
    async deleteTool(
        @Param('id', ParseUUIDPipe) id: string
    ): Promise<void> {
        const response = await this.toolsService.deleteTool(id);
        if (!response.success) {
            throw new HttpException(
                response.error,
                response.error.code === 'TOOL_NOT_FOUND'
                    ? HttpStatus.NOT_FOUND
                    : HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    // Category endpoints
    @Post('categories')
    async createCategory(
        @Body(new ValidationPipe()) createCategoryDto: CreateCategoryDto
    ) {
        const response = await this.toolsService.createCategory(createCategoryDto);
        if (!response.success) {
            throw new HttpException(
                response.error,
                HttpStatus.BAD_REQUEST
            );
        }
        return response.data;
    }

    @Get('categories')
    async getCategories() {
        const response = await this.toolsService.getCategories();
        if (!response.success) {
            throw new HttpException(
                response.error,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
        return response.data;
    }

    @Put('categories/:id')
    async updateCategory(
        @Param('id', ParseUUIDPipe) id: string,
        @Body(new ValidationPipe()) updateCategoryDto: UpdateCategoryDto
    ) {
        const response = await this.toolsService.updateCategory(id, updateCategoryDto);
        if (!response.success) {
            throw new HttpException(
                response.error,
                response.error.code === 'CATEGORY_NOT_FOUND'
                    ? HttpStatus.NOT_FOUND
                    : HttpStatus.BAD_REQUEST
            );
        }
        return response.data;
    }

    @Delete('categories/:id')
    async deleteCategory(
        @Param('id', ParseUUIDPipe) id: string
    ): Promise<void> {
        const response = await this.toolsService.deleteCategory(id);
        if (!response.success) {
            throw new HttpException(
                response.error,
                response.error.code === 'CATEGORY_NOT_FOUND'
                    ? HttpStatus.NOT_FOUND
                    : HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}