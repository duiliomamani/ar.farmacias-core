import { Model, Document } from 'mongoose';
import { IBaseRepository } from '../../../domain/interfaces/repository.interface';

export abstract class BaseRepository<TEntity, TDocument extends Document> implements IBaseRepository<TEntity> {
  constructor(protected readonly model: Model<TDocument>) {}

  async create(item: Omit<TEntity, 'id'>): Promise<TEntity> {
    const createdDoc = new this.model(item);
    const savedDoc = await createdDoc.save();
    return this.mapToEntity(savedDoc);
  }

  async update(id: string, item: Partial<TEntity>): Promise<TEntity | null> {
    const updatedDoc = await this.model
      .findByIdAndUpdate(id, { $set: item } as any, { new: true })
      .exec();
    return updatedDoc ? this.mapToEntity(updatedDoc) : null;
  }

  async findOne(filter: any): Promise<TEntity | null> {
    const doc = await this.model.findOne(filter).exec();
    return doc ? this.mapToEntity(doc) : null;
  }

  async findById(id: string): Promise<TEntity | null> {
    const doc = await this.model.findById(id).exec();
    return doc ? this.mapToEntity(doc) : null;
  }

  async findAll(): Promise<TEntity[]> {
    const docs = await this.model.find().exec();
    return docs.map(doc => this.mapToEntity(doc));
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.model.findByIdAndDelete(id).exec();
    return !!result;
  }

  abstract upsert(item: TEntity): Promise<TEntity>;

  protected abstract mapToEntity(doc: TDocument): TEntity;
}
