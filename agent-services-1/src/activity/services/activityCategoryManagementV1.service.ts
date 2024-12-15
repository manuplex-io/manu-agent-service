import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OB1AgentActivityCategory } from '../entities/ob1-agent-activityCategory.entity';
import { OB1Activity } from '../interfaces/activity.interface';

@Injectable()
export class ActivityCategoryManagementV1Service {
    private readonly logger = new Logger(ActivityCategoryManagementV1Service.name);
    constructor(
        @InjectRepository(OB1AgentActivityCategory)
        private readonly categoryRepository: Repository<OB1AgentActivityCategory>,
    ) { }

    // Create Activity Category
    async createCategory(
        createCategoryDto: OB1Activity.CreateCategory,
    ): Promise<OB1Activity.ServiceResponse<OB1Activity.CategoryResponse>> {
        try {
            const transformedCategoryDto = {
                ...createCategoryDto,
                activityCategoryCreatedByPersonId: createCategoryDto.personId,
                activityCategoryCreatedByConsultantOrgShortName: createCategoryDto.consultantOrgShortName,
            };

            const category = this.categoryRepository.create(transformedCategoryDto);
            const savedCategory = await this.categoryRepository.save(category);

            return {
                success: true,
                data: this.mapToCategoryResponse(savedCategory),
            };
        } catch (error) {
            this.logger.error(`Failed to create activity category: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to create activity category',
                code: 'CATEGORY_CREATION_FAILED',
                errorSuperDetails: { ...error },
            });
        }
    }

    // Get All Activity Categories
    async getCategories(
        getCategoryBody: OB1Activity.GetCategory,
    ): Promise<OB1Activity.ServiceResponse<OB1Activity.CategoryResponse[]>> {
        try {
            const { consultantOrgShortName } = getCategoryBody;
            const categories = await this.categoryRepository.find({
                where: {
                    activityCategoryCreatedByConsultantOrgShortName: consultantOrgShortName
                }
            });

            return {
                success: true,
                data: categories.map(this.mapToCategoryResponse),
            };
        } catch (error) {
            this.logger.error(`Failed to fetch activity categories: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to fetch activity categories',
                code: 'CATEGORY_FETCH_FAILED',
                errorSuperDetails: { ...error },
            });
        }
    }

    // Get Single Activity Category by ID
    async getCategory(
        id: string,
    ): Promise<OB1Activity.ServiceResponse<OB1Activity.CategoryResponse>> {
        try {
            const category = await this.categoryRepository.findOne({ where: { activityCategoryId: id } });

            if (!category) {
                throw new BadRequestException({
                    message: `Activity category with ID ${id} not found`,
                    code: 'CATEGORY_NOT_FOUND',
                });
            }

            return {
                success: true,
                data: this.mapToCategoryResponse(category),
            };
        } catch (error) {
            this.logger.error(`Failed to fetch activity category: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to fetch activity category',
                code: 'CATEGORY_FETCH_FAILED',
                errorSuperDetails: { ...error },
            });
        }
    }

    // Update Activity Category
    async updateCategory(
        id: string,
        updateCategoryDto: OB1Activity.UpdateCategory,
    ): Promise<OB1Activity.ServiceResponse<OB1Activity.CategoryResponse>> {
        try {
            const category = await this.categoryRepository.findOne({ where: { activityCategoryId: id } });

            if (!category) {
                throw new BadRequestException({
                    message: `Activity category with ID ${id} not found`,
                    code: 'CATEGORY_NOT_FOUND',
                });
            }

            Object.assign(category, updateCategoryDto);
            const updatedCategory = await this.categoryRepository.save(category);

            return {
                success: true,
                data: this.mapToCategoryResponse(updatedCategory),
            };
        } catch (error) {
            this.logger.error(`Failed to update activity category: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to update activity category',
                code: 'CATEGORY_UPDATE_FAILED',
                errorSuperDetails: { ...error },
            });
        }
    }

    // Delete Activity Category
    async deleteCategory(id: string): Promise<OB1Activity.ServiceResponse<void>> {
        try {
            const result = await this.categoryRepository.delete(id);

            if (result.affected === 0) {
                throw new BadRequestException({
                    message: `Activity category with ID ${id} not found`,
                    code: 'CATEGORY_NOT_FOUND',
                });
            }

            return { success: true };
        } catch (error) {
            this.logger.error(`Failed to delete activity category: ${error.message}`, error.stack);
            throw new BadRequestException({
                message: 'Failed to delete activity category',
                code: 'CATEGORY_DELETE_FAILED',
                errorSuperDetails: { ...error },
            });
        }
    }

    // Helper Method: Map to Category Response
    private mapToCategoryResponse(
        category: OB1AgentActivityCategory,
    ): OB1Activity.CategoryResponse {
        return {
            activityCategoryId: category.activityCategoryId,
            activityCategoryName: category.activityCategoryName,
            activityCategoryDescription: category.activityCategoryDescription,
            activityCategoryCreatedBypersonId: category.activityCategoryCreatedByPersonId,
            activityCategoryCreatedByConsultantOrgShortName: category.activityCategoryCreatedByConsultantOrgShortName,
        };
    }
}
