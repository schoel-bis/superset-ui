/* eslint react/sort-comp: 'off' */
import React, { ReactNode } from 'react';
import { SupersetClientInterface, RequestConfig } from '../../../superset-ui-connection/src/types';

import ChartClient, { SliceIdAndOrFormData } from '../clients/ChartClient';
import { ChartFormData } from '../types/ChartFormData';
import { QueryData } from '../models/ChartProps';

interface Payload {
  formData: Partial<ChartFormData>;
  queryData: QueryData;
}

export interface ProvidedProps {
  payload?: Payload;
  error?: Error;
  loading?: boolean;
}

export type Props =
  /** User can pass either one or both of sliceId or formData */
  SliceIdAndOrFormData & {
    /** Child function called with ProvidedProps */
    children: (provided: ProvidedProps) => ReactNode;
    /** Superset client which is used to fetch data. It should already be configured and initialized. */
    client?: SupersetClientInterface;
    /** Will fetch and include datasource metadata for SliceIdAndOrFormData in the payload. */
    loadDatasource: boolean;
    /** Callback when an error occurs. Enables wrapping the Provider in an ErrorBoundary. */
    onError?: (error: ProvidedProps['error']) => void;
    /** Callback when data is loaded. */
    onLoaded?: (payload: ProvidedProps['payload']) => void;
    /** Hook to override the request config */
    requestOptions?: (requestConfig: RequestConfig) => RequestConfig;
  };

type State = {
  status: 'unitialized' | 'fetching' | 'error' | 'loaded';
  payload?: ProvidedProps['payload'];
  error?: ProvidedProps['error'];
};

class ChartDataProvider extends React.PureComponent<Props, State> {
  readonly chartClient: ChartClient;

  constructor(props: Props) {
    super(props);
    this.handleFetchData = this.handleFetchData.bind(this);
    this.handleReceiveData = this.handleReceiveData.bind(this);
    this.handleError = this.handleError.bind(this);
    this.chartClient = new ChartClient({ client: props.client });
    this.state = { status: 'unitialized' };
  }

  componentDidMount() {
    this.handleFetchData();
  }

  componentDidUpdate(prevProps: Props) {
    const { formData, sliceId } = this.props;
    if (formData !== prevProps.formData || sliceId !== prevProps.sliceId) {
      this.handleFetchData();
    }
  }

  private extractSliceIdAndFormData() {
    const { formData, sliceId } = this.props;
    const result: any = {};

    if (formData) result.formData = formData;
    if (sliceId) result.sliceId = sliceId;

    return result as SliceIdAndOrFormData;
  }

  private handleFetchData() {
    const { loadDatasource } = this.props;
    const sliceIdAndOrFormData = this.extractSliceIdAndFormData();

    this.setState({ status: 'fetching' }, () => {
      try {
        this.chartClient
          .loadFormData(sliceIdAndOrFormData)
          .then(formData =>
            Promise.all([
              loadDatasource
                ? this.chartClient.loadDatasource(formData.datasource)
                : Promise.resolve(undefined),
              this.chartClient.loadQueryData(formData),
            ]).then(([datasource, queryData]) => ({
              datasource,
              formData,
              queryData,
            })),
          )
          .then(this.handleReceiveData)
          .catch(this.handleError);
      } catch (error) {
        this.handleError(error);
      }
    });
  }

  handleReceiveData(data: Payload) {
    const { onLoaded } = this.props;
    if (onLoaded) onLoaded(data);
    this.setState({ payload: data, status: 'loaded' });
  }

  handleError(error: ProvidedProps['error']) {
    const { onError } = this.props;
    if (onError) onError(error);
    this.setState({ error, status: 'error' });
  }

  render() {
    const { children } = this.props;
    const { status, payload, error } = this.state;

    const provided: ProvidedProps = {};

    if (status === 'unitialized') {
      return null;
    } else if (status === 'fetching') {
      provided.loading = true;
    } else if (status === 'error') {
      provided.error = error;
    } else if (status === 'loaded') {
      provided.payload = payload;
    }

    return children(provided);
  }
}

export default ChartDataProvider;
