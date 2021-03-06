import * as areEqual from 'fbjs/lib/areEqual';
import { GraphQLTaggedNode, OperationType, IEnvironment, isPromise } from 'relay-runtime';
import { QueryFetcher } from './QueryFetcher';
import { RenderProps, QueryOptions } from './RelayHooksType';
import { createOperation } from './Utils';

export type LoadQuery<TOperationType extends OperationType = OperationType> = {
    next: (
        environment: IEnvironment,
        gqlQuery: GraphQLTaggedNode,
        variables?: TOperationType['variables'],
        options?: QueryOptions,
    ) => Promise<void>;
    subscribe: (callback: (value: any) => any) => () => void;
    getValue: (environment?: IEnvironment) => RenderProps<TOperationType> | Promise<any>;
    dispose: () => void;
};

const internalLoadQuery = <TOperationType extends OperationType = OperationType>(
    promise = false,
): LoadQuery<TOperationType> => {
    let data: RenderProps<TOperationType> | null | Promise<any> = null;
    let listener;

    const queryFetcher = new QueryFetcher<TOperationType>(true);

    const prev = {
        environment: null,
        gqlQuery: null,
        variables: null,
        options: null,
        query: null,
    };

    const dispose = (): void => {
        queryFetcher.dispose();
        listener = null;
    };

    const next = (
        environment,
        gqlQuery: GraphQLTaggedNode,
        variables: TOperationType['variables'] = {},
        options: QueryOptions = {},
    ): Promise<void> => {
        prev.environment = environment;
        prev.options = options;
        if (!areEqual(variables, prev.variables) || gqlQuery != prev.gqlQuery) {
            prev.variables = variables;
            prev.gqlQuery = gqlQuery;
            prev.query = createOperation(gqlQuery, prev.variables);
        }
        const execute = (): void => {
            data = queryFetcher.execute(prev.environment, prev.query, prev.options);
            listener && listener(data);
        };

        queryFetcher.setForceUpdate(execute);
        let result;
        try {
            execute();
        } catch (e) {
            result = e.then(execute);
            if (promise) {
                data = result;
            } else {
                execute();
            }
        }
        return result ?? Promise.resolve();
    };

    const getValue = (
        environment?: IEnvironment,
    ): RenderProps<TOperationType> | null | Promise<any> => {
        if (environment && environment != prev.environment) {
            next(environment, prev.gqlQuery, prev.variables, prev.options);
        }
        if (isPromise(data)) {
            throw data;
        }

        return data;
    };

    const subscribe = (callback: (value) => any): (() => void) => {
        listener = callback;
        return dispose;
    };
    return {
        next,
        subscribe,
        getValue,
        dispose,
    };
};

export const loadLazyQuery = <
    TOperationType extends OperationType = OperationType
>(): LoadQuery<TOperationType> => {
    return internalLoadQuery(true);
};

export const loadQuery = <
    TOperationType extends OperationType = OperationType
>(): LoadQuery<TOperationType> => {
    return internalLoadQuery(false);
};
